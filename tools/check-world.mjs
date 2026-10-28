// Prints the live top 10 of each world topic: node tools/check-world.mjs [id …]
import fs from 'node:fs';
import { worldRows } from '../src/sources.mjs';
const T = JSON.parse(fs.readFileSync(new URL('../content/topics-world.json', import.meta.url)));
const want = process.argv.slice(2).filter(a => a !== 'world' && a !== 'all');
for (const t of T.filter(x => !want.length || want.includes(x.id))) {
  try {
    const { rows, date, via } = await worldRows(t);
    console.log(`== ${t.id} (${date}, ${via}): ${rows.length} rows`);
    rows.slice(0, 10).forEach((r, i) => console.log(`  ${i + 1}. ${r.flag} ${r.name} — ${Math.round(r.value * 100) / 100}${r.sub ? ' · ' + r.sub : ''}${r.img ? ' [img ' + Math.round(r.img.length / 1024) + 'KB]' : ''}`));
  } catch (e) { console.log(`== ${t.id}: ERROR ${e.message}`); }
}
