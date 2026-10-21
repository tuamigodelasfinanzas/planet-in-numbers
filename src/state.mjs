// Records what was published (so topics/countries don't repeat). Usage: node src/state.mjs <state.json> <item.json>
import fs from 'node:fs';
const [stateFile, itemFile] = process.argv.slice(2);
let st = {}; try { st = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
const it = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
const at = new Date().toISOString();
(st[it.series] ||= []).push(it.episode);
st[it.series] = st[it.series].slice(-60);
if (it.topic) { (st._topics ||= []).push({ id: it.topic, at }); st._topics = st._topics.slice(-40); }
(st._log ||= []).push({ at, id: it.id, kind: it.kind, title: it.title, fact: it.fact || null });
st._log = st._log.slice(-60);
if (it.cupState) { st.cup = it.cupState; st.cupPost = it.caption.split('\n')[0]; delete st.cupVotes; }
fs.writeFileSync(stateFile, JSON.stringify(st, null, 1));
console.log('state updated:', it.id);
