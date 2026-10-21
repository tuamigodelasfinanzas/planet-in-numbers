// Checks Our World in Data charts: does the CSV exist, which columns, how many countries, latest year.
// Usage: node tools/check-owid.mjs slug1 slug2 …   (prints one ::notice:: per slug)
const slugs = process.argv.slice(2);
for (const slug of slugs) {
  try {
    const r = await fetch(`https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=false`, { headers: { 'User-Agent': 'planet-in-numbers/1.0' }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) { console.log(`::notice::NO ${slug} HTTP ${r.status}`); continue; }
    const text = await r.text();
    const lines = text.trim().split('\n');
    const head = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine).filter(c => /^[A-Z]{3}$/.test(c[1] || ''));
    const years = rows.map(c => Number(c[2])).filter(Boolean);
    const maxY = Math.max(...years);
    const latest = new Map(); for (const c of rows) { const y = Number(c[2]); if (c[3] !== '' && (!latest.has(c[1]) || y > latest.get(c[1]))) latest.set(c[1], y); }
    const recent = [...latest.values()].filter(y => y >= maxY - 5).length;
    const sample = rows.find(c => c[1] === 'ESP' && Number(c[2]) === latest.get('ESP'));
    console.log(`::notice::OK ${slug} | cols: ${head.slice(3).join(' || ').slice(0, 220)} | countries: ${latest.size} (recent ${recent}) | latest year ${maxY} | ESP ${sample ? sample.slice(2, 4).join(':') : '-'}`);
  } catch (e) { console.log(`::notice::NO ${slug} ${String(e.message).slice(0, 80)}`); }
}
function parseLine(l) {
  const out = []; let cur = '', q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
