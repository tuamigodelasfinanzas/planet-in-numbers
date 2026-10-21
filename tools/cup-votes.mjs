// Counts the votes of the last World Cup match from the comments of its post on Instagram, Facebook and YouTube (one vote per person and platform).
// Usage: IG_TOKEN=… IG_USER=… node tools/cup-votes.mjs <state used.json>   → writes state.cupVotes = {ISO3: n}
import fs from 'node:fs';
import { countries } from '../src/wb.mjs';
import { detectCountries } from '../src/replies.mjs';
import { facebook, youtube, key } from './social.mjs';

const [stateFile] = process.argv.slice(2);
const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const cup = st.cup;
if (!cup || cup.pending == null) { console.log('No open match: nothing to count'); process.exit(0); }
const m = cup.matches[cup.pending];
const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER;
if (!token || !user) { console.log('::warning::No Instagram token: the data will decide this match'); process.exit(0); }
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const call = async (url) => { const r = await fetch(url); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; };

const cs = await countries();
const voted = new Set(), votes = { [m.a]: 0, [m.b]: 0 }, per = {};
const count = (platform, user, text) => {
  const id = `${platform}:${user}`;
  if (!user || voted.has(id)) return;
  const pick = detectCountries(text, cs).find(iso => iso === m.a || iso === m.b);
  if (pick) { votes[pick]++; voted.add(id); per[platform] = (per[platform] || 0) + 1; }
};

// Instagram
try {
  const posts = (await call(`${API}/${user}/media?fields=id,caption&limit=25&access_token=${token}`)).data || [];
  const post = posts.find(p => key(p.caption) === key(st.cupPost));
  if (!post) console.log('::warning::Instagram: match post not found');
  let url = post && `${API}/${post.id}/comments?fields=username,text&limit=50&access_token=${token}`, pages = 0;
  while (url && pages++ < 40) { const j = await call(url); for (const c of j.data || []) count('ig', c.username, c.text); url = j.paging?.next || null; }
} catch (e) { console.log('::warning::Instagram votes: ' + e.message); }

// Facebook and YouTube (same post, matched by the first line of the caption)
for (const [name, make] of [['fb', () => facebook(token)], ['yt', () => youtube(process.env.MAKE_HOOK)]]) {
  try {
    const pf = await make(); if (pf.error) { console.log(`${name}: no votes counted (${pf.error})`); continue; }
    const post = (await pf.posts()).find(p => key(p.caption) === key(st.cupPost));
    if (!post) { console.log(`${name}: match post not found`); continue; }
    for (const c of await pf.comments(post.id, true)) if (!c.own) count(name, c.user, c.text);
  } catch (e) { console.log(`::warning::${name} votes: ${e.message}`); }
}
st.cupVotes = votes;
fs.writeFileSync(stateFile, JSON.stringify(st, null, 1));
console.log(`::notice::Votes: ${m.a} ${votes[m.a]} – ${votes[m.b]} ${m.b} (by platform: ${JSON.stringify(per)})`);
