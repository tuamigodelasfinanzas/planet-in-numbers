// Quality audit of every topic with real data: countries, year, top 3, bottom, and problems.
// Usage: node tools/audit-topics.mjs > audit.txt
import fs from 'node:fs';
import { latestOf, bigCountries } from '../src/wb.mjs';
import { show } from '../src/fmt.mjs';

const topics = [...JSON.parse(fs.readFileSync(new URL('../content/topics.json', import.meta.url))), ...JSON.parse(fs.readFileSync(new URL('../content/topics-owid.json', import.meta.url)))];
const big = await bigCountries(1e6);
const NOW = new Date().getUTCFullYear();
let bad = 0;
for (const t of topics) {
  try {
    let rows = (await latestOf(t)).filter(r => t.minPop === 0 || big.has(r.iso3));
    if (!t.yearLabel) { const my = Math.max(...rows.map(r => r.year)); rows = rows.filter(r => r.year >= my - (t.window ?? 3)); }
    rows.sort((a, b) => (t.dir === 'asc' ? a.value - b.value : b.value - a.value));
    const years = rows.map(r => r.year), maxY = Math.max(...years), minTop = Math.min(...rows.slice(0, 10).map(r => r.year));
    const issues = [];
    if (rows.length < 40) issues.push(`only ${rows.length} countries`);
    if (NOW - maxY > 4 && !t.yearLabel) issues.push(`old data (${maxY})`);
    if (maxY - minTop > (t.window ?? 3)) issues.push(`top 10 mixes years ${minTop}-${maxY}`);
    if (rows.slice(0, 10).some(r => !Number.isFinite(r.value))) issues.push('bad values');
    if (issues.length) bad++;
    const fmt = r => `${r.name} ${show(r.value, t.fmt)}`;
    console.log(`${issues.length ? 'CHECK' : 'OK   '} ${t.id.padEnd(18)} n=${rows.length} y=${maxY} | ${rows.slice(0, 3).map(fmt).join(' · ')} | last: ${fmt(rows.at(-1))}${issues.length ? ' | ' + issues.join('; ') : ''}`);
  } catch (e) { bad++; console.log(`FAIL  ${t.id.padEnd(18)} ${e.message.slice(0, 120)}`); }
}
console.log(`\n${topics.length} topics, ${bad} to review`);
