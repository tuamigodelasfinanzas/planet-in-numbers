// Shared page assets: font, logo, world map, browser launcher
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { C, FONT, EMOJI, logoSVG } from './brand.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

export async function browser() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
  const exe = process.env.PIN_CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
  return chromium.launch({ executablePath: exe, args: ['--font-render-hinting=none'] });
}

export function fontCSS() {
  const faces = [];
  for (const w of [500, 700]) {
    for (const base of [path.join(ROOT, 'node_modules/@fontsource/space-grotesk/files'), path.join(ROOT, 'assets/fonts')]) {
      const f = path.join(base, `space-grotesk-latin-${w}-normal.woff2`);
      if (fs.existsSync(f)) { faces.push(`@font-face{font-family:'Space Grotesk';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2')}`); break; }
    }
  }
  if (!faces.length) console.warn('WARNING: Space Grotesk not found, using a fallback font');
  return faces.join('\n');
}

export function pageHTML(w, h, body = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCSS()}
  *{box-sizing:border-box;margin:0;padding:0} html,body{width:${w}px;height:${h}px;overflow:hidden;background:${C.bg}}
  body{font-family:${FONT};color:${C.text};-webkit-font-smoothing:antialiased}
  #stage{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(ellipse at 50% 0%,#11264A 0%,${C.bg} 60%)}
  </style></head><body><div id="stage">${body}</div></body></html>`;
}

export const logo = (px) => logoSVG(px);
export const EMOJI_FONT = EMOJI;

// World map as SVG (Equal Earth). values: iso3 -> 0..1 (1 = highest)
export async function mapSVG(values, width = 1020) {
  let geoEqualEarth, geoPath;
  try { ({ geoEqualEarth, geoPath } = await import('d3-geo')); } catch { ({ geoEqualEarth, geoPath } = await import('/opt/npm-tools/node_modules/d3-geo/src/index.js')); }
  const geo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/geo/countries.geo.json'), 'utf8'));
  geo.features = geo.features.filter(f => f.id !== 'ATA');
  // the source file uses the opposite ring order to d3: a ring covering more than half the globe gets reversed
  let geoArea; try { ({ geoArea } = await import('d3-geo')); } catch { ({ geoArea } = await import('/opt/npm-tools/node_modules/d3-geo/src/index.js')); }
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) if (geoArea({ type: 'Polygon', coordinates: [ring] }) > 2 * Math.PI) ring.reverse();
  }
  const height = Math.round(width * 0.52);
  const proj = geoEqualEarth().fitSize([width, height], geo);
  const gp = geoPath(proj);
  const col = t => mix(t);
  const paths = geo.features.map(f => {
    const t = values[f.id];
    const d = gp(f); if (!d) return '';
    return t == null ? `<path d="${d}" fill="${MAP.none}" stroke="${C.bg}" stroke-width="0.8"/>`
      : `<path d="${d}" data-t="${t.toFixed(3)}" data-c="${col(t)}" fill="${MAP.none}" stroke="${C.bg}" stroke-width="0.8"/>`;
  }).join('');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg>`;
}
export const MAP = { none: '#1A3150', low: '#23406B', mid: '#8FA9CF' };
function hex(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(t) {
  const stops = [[0, hex(MAP.low)], [0.55, hex(MAP.mid)], [1, hex(C.accent)]];
  let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
  const [a, ca] = stops[k], [b, cb] = stops[k + 1], f = (t - a) / (b - a);
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * f).toString(16).padStart(2, '0')).join('');
}
