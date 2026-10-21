// Corporate identity of Planet in Numbers (same colors as the logo)
export const C = {
  bg: '#0A1628',      // night navy (logo background)
  card: '#132A4A',    // raised panels
  line: '#22406A',    // dividers, empty bars
  bar: '#DCE8FF',     // light bars (logo globe bars)
  accent: '#FF8A3D',  // orange highlight (logo equator bar)
  text: '#F4F7FB',    // main text
  muted: '#9FB3CC',   // secondary text
  good: '#2EE6A6',    // used sparingly for "up"
};
export const HANDLE = '@theplanetinnumbers';
export const NAME = 'Planet in Numbers';
export const FONT = `'Space Grotesk','Inter','DejaVu Sans',sans-serif`;
export const EMOJI = `'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji'`;

// The logo (globe of bars), as an SVG string. size in px.
export function logoSVG(size = 120, { bar = C.bar, cut = C.bg, ring = 'rgba(220,232,255,0.35)', accent = C.accent } = {}) {
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  const rows = [[154, 370], [234, 470], [314, 410], [394, 620], [474, 330], [554, 500], [634, 290]];
  return `<svg width="${size}" height="${size}" viewBox="224 104 632 632" aria-hidden="true">
  <defs><clipPath id="${id}"><circle cx="540" cy="420" r="280"/></clipPath></defs>
  <circle cx="540" cy="420" r="306" fill="none" stroke="${ring}" stroke-width="6"/>
  <g clip-path="url(#${id})">${rows.map(([y, w], i) => `<rect x="230" y="${y}" width="${w}" height="52" rx="26" fill="${i === 3 ? accent : bar}"/>`).join('')}
  <ellipse cx="540" cy="420" rx="118" ry="290" fill="none" stroke="${cut}" stroke-width="12"/></g></svg>`;
}
