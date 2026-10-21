// Answers new comments on the latest posts, with the data of each post.
// Usage: IG_TOKEN=… IG_USER=… SITE=<gh-pages folder> [DRY=true] node tools/comments.mjs
// Stateless: a comment the account already answered is never answered again.
import fs from 'node:fs';
import path from 'node:path';
import { countries } from '../src/wb.mjs';
import { replyFor } from '../src/replies.mjs';

const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER, DRY = process.env.DRY === 'true';
if (!token || !user) { console.log('::warning::No IG_ACCESS_TOKEN / IG_USER_ID: nothing to do'); process.exit(0); }
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const MAX = 15, HOURS = 72;

// our posts, to know what each Instagram post is about (matched by the first line of the caption)
const key = s => String(s || '').split('\n')[0].replace(/\s+/g, ' ').trim().toLowerCase();
const items = new Map();
const media = path.join(process.env.SITE || 'site', 'media');
if (fs.existsSync(media)) for (const d of fs.readdirSync(media)) {
  try { const it = JSON.parse(fs.readFileSync(path.join(media, d, 'item.json'), 'utf8')); items.set(key(it.caption), it); } catch {}
}

const call = async (p, params = {}, method = 'GET') => {
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = method === 'GET' ? await fetch(`${API}/${p}?${body}`) : await fetch(`${API}/${p}`, { method, body });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`); return j;
};

const cs = await countries();
const me = (await call(user, { fields: 'username' })).username;
const posts = (await call(`${user}/media`, { fields: 'id,caption,timestamp', limit: 15 })).data || [];
const since = Date.now() - HOURS * 3600e3;
let done = 0, seen = 0;
for (const p of posts) {
  const it = items.get(key(p.caption));
  let list = [];
  try { list = (await call(`${p.id}/comments`, { fields: 'id,text,username,timestamp,replies{username}', limit: 50 })).data || []; }
  catch (e) { console.log(`::warning::No access to comments of ${p.id}: ${e.message}`); continue; }
  for (const c of list) {
    if (!c.username || c.username === me || Date.parse(c.timestamp) < since) continue;
    if ((c.replies?.data || []).some(r => r.username === me)) continue;
    seen++;
    const text = replyFor(c, it, cs);
    if (!text) continue;
    if (done >= MAX) { console.log(`Limit of ${MAX} replies per run reached; the rest go in the next one.`); break; }
    if (DRY) { console.log(`[TEST] ${c.username}: «${c.text}» → ${text}`); done++; continue; }
    try { await call(`${c.id}/replies`, { message: text }, 'POST'); console.log(`Replied to ${c.username}`); done++; await new Promise(r => setTimeout(r, 8000)); }
    catch (e) { console.log(`::warning::Could not reply to ${c.username}: ${e.message}`); }
  }
}
console.log(`::notice::Checked ${posts.length} posts, ${seen} new comments, ${done} replies${DRY ? ' (test, not posted)' : ''}`);
