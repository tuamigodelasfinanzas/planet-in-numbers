// Publishes an Instagram carousel whose slides are videos (so it has music), waiting for each video to be processed.
// Usage: IG_TOKEN=… IG_USER=… node tools/ig-carousel.mjs "<caption file>" <url1> <url2> … [--dry]
// --dry: creates and checks the containers but does NOT publish (unpublished containers expire on their own).
import fs from 'node:fs';

const args = process.argv.slice(2), DRY = args.includes('--dry');
const [capFile, ...urls] = args.filter(a => a !== '--dry');
const token = String(process.env.IG_TOKEN || '').replace(/[\s"']/g, ''), user = process.env.IG_USER;
if (!token || !user) { console.log('::warning::No IG token'); process.exit(2); }
const API = token.startsWith('IG') ? 'https://graph.instagram.com/v21.0' : 'https://graph.facebook.com/v21.0';
const call = async (p, params = {}, method = 'POST') => {
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = method === 'GET' ? await fetch(`${API}/${p}?${body}`) : await fetch(`${API}/${p}`, { method, body });
  const j = await r.json(); if (j.error) throw new Error(`${p}: ${j.error.message}${j.error.error_user_msg ? ' · ' + j.error.error_user_msg : ''}`); return j;
};
const wait = async (id, what) => {
  for (let i = 0; i < 60; i++) {
    const s = await call(id, { fields: 'status_code,status' }, 'GET');
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`${what}: ${s.status_code} ${s.status || ''}`);
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error(`${what}: still processing after 10 min`);
};

const children = [];
for (const [i, u] of urls.entries()) {
  const c = await call(`${user}/media`, { media_type: 'VIDEO', video_url: u, is_carousel_item: 'true' });
  children.push(c.id); console.log(`slide ${i + 1}: container ${c.id}`);
}
for (const [i, id] of children.entries()) { await wait(id, `slide ${i + 1}`); console.log(`slide ${i + 1}: ready`); }
const caption = fs.readFileSync(capFile, 'utf8');
const car = await call(`${user}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
await wait(car.id, 'carousel');
if (DRY) { console.log(`::notice::Carousel with music ready (${children.length} video slides) — test: NOT published`); process.exit(0); }
const pub = await call(`${user}/media_publish`, { creation_id: car.id });
console.log(`::notice::Published on Instagram: carousel with music ${pub.id}`);
