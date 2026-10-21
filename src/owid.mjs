// Our World in Data charts (free, CC BY). Only real countries (ISO3 codes), only real years (no projections).
// Offline tests: PIN_FIXTURE=<dir> reads <dir>/owid-<slug>.csv
import fs from 'node:fs';
import path from 'node:path';

const CACHE = process.env.PIN_CACHE || '.cache';
const FIX = process.env.PIN_FIXTURE || '';
const NOW = new Date().getUTCFullYear();

function parseLine(l) {
  const out = []; let cur = '', q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}

async function csv(slug) {
  const f = FIX ? path.join(FIX, `owid-${slug}.csv`) : path.join(CACHE, `owid-${slug}.csv`);
  if (FIX || (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 6 * 3600e3)) return fs.readFileSync(f, 'utf8');
  let err;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=false`, { headers: { 'User-Agent': 'planet-in-numbers/1.0' }, signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const t = await r.text();
      fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, t);
      return t;
    } catch (e) { err = e; await new Promise(r => setTimeout(r, 3000 * (i + 1))); }
  }
  throw new Error(`No data from Our World in Data (${slug}): ${err?.message}`);
}

// Rows {iso3, year, value} for the chosen column (topic.col = part of the column name; default: first data column)
export async function owidRows(topic) {
  const lines = (await csv(topic.slug)).trim().split('\n');
  const head = parseLine(lines[0]);
  let ci = topic.col ? head.findIndex((h, i) => i >= 3 && h.toLowerCase().includes(topic.col.toLowerCase())) : 3;
  if (ci < 0) throw new Error(`Column "${topic.col}" not found in ${topic.slug}`);
  if (/annotations|projected|world region/i.test(head[ci])) throw new Error(`Bad column ${head[ci]} in ${topic.slug}`);
  const out = [];
  for (const l of lines.slice(1)) {
    const c = parseLine(l);
    if (!/^[A-Z]{3}$/.test(c[1] || '')) continue;
    const year = Number(c[2]), v = c[ci];
    if (!year || year > NOW || v === '' || v == null) continue;
    const value = Number(v) * (topic.mult || 1);
    if (Number.isFinite(value)) out.push({ iso3: c[1], year, value });
  }
  if (out.length < 30) throw new Error(`Too little data in ${topic.slug} (${out.length} rows)`);
  return out;
}
