// Prints the series for a slot today (Madrid time). Usage: node src/plan.mjs <A|B|C> [YYYY-MM-DD]
import fs from 'node:fs';
const plan = JSON.parse(fs.readFileSync(new URL('../content/plan.json', import.meta.url)));
const [slot, date] = process.argv.slice(2);
const d = date ? new Date(date + 'T12:00:00Z') : new Date();
const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Madrid' }).format(d).toLowerCase().slice(0, 3);
process.stdout.write(plan[wd]?.[slot] || '');
