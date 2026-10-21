// Counts the votes of the last World Cup match from the comments of its post (one vote per person).
// Usage: IG_TOKEN=… IG_USER=… node tools/cup-votes.mjs <state used.json>   → writes state.cupVotes = {ISO3: n}
import fs from 'node:fs';
import { countries } from '../src/wb.mjs';
import { detectCountries } from '../src/replies.mjs';

const [stateFile] = process.argv.slice(2);
const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const cup = st.cup;
if (!cup || cup.pending == null) { console.log('No open match: nothing to count'); process.exit(0); }
const m = cup.matches[cup.pending];
const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER;
if (!token || !user) { console.log('::warning::No Instagram token: the data will decide this match'); process.exit(0); }
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const call = async (url) => { const r = await fetch(url); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; };

const key = s => String(s || '').split('\n')[0].trim();
const posts = (await call(`${API}/${user}/media?fields=id,caption&limit=25&access_token=${token}`)).data || [];
const post = posts.find(p => key(p.caption) === st.cupPost);
if (!post) { console.log('::warning::Match post not found: the data will decide'); process.exit(0); }

const cs = await countries();
const voted = new Set(), votes = { [m.a]: 0, [m.b]: 0 };
let url = `${API}/${post.id}/comments?fields=username,text&limit=50&access_token=${token}`, pages = 0;
while (url && pages++ < 40) {
  const j = await call(url);
  for (const c of j.data || []) {
    if (!c.username || voted.has(c.username)) continue;
    const pick = detectCountries(c.text, cs).find(iso => iso === m.a || iso === m.b);
    if (pick) { votes[pick]++; voted.add(c.username); }
  }
  url = j.paging?.next || null;
}
st.cupVotes = votes;
fs.writeFileSync(stateFile, JSON.stringify(st, null, 1));
console.log(`::notice::Votes: ${m.a} ${votes[m.a]} – ${votes[m.b]} ${m.b}`);
