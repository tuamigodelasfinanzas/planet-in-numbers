// Sends a video (or the carousel slides) to Telegram so it can be posted to TikTok by hand.
// Usage: node src/telegram.mjs <item.json> <video.mp4 | slides dir>   (env TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
import fs from 'node:fs';
import path from 'node:path';

const [itemFile, media] = process.argv.slice(2);
const TOKEN = process.env.TELEGRAM_BOT_TOKEN, CHAT = process.env.TELEGRAM_CHAT_ID;
if (!TOKEN || !CHAT) { console.log('::warning::No TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID: nothing sent'); process.exit(0); }
const item = JSON.parse(fs.readFileSync(itemFile, 'utf8'));

// TikTok text: short, first lines of the caption + 4 hashtags
const cap = (!fs.statSync(media).isDirectory() && item.videoCaption) || item.caption;
const lines = cap.split('\n').filter(l => l.trim() && !/^(📊|#)/.test(l.trim()));
let text = lines.slice(0, 4).join('\n');
const tags = [...new Set(cap.match(/#[\p{L}\p{N}_]+/gu) || [])].slice(0, 3);
text = `${text}\n\n${[...tags, '#fyp'].join(' ')}`;

const api = (m, body) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', body }).then(r => r.json()).then(j => { if (!j.ok) throw new Error(`${m}: ${j.description}`); return j; });
const head = `🌍 Planet in Numbers · TikTok\n${item.title}`;

if (fs.statSync(media).isDirectory()) {
  const files = fs.readdirSync(media).filter(f => f.endsWith('.jpg')).sort();
  const f = new FormData();
  f.append('chat_id', CHAT);
  f.append('media', JSON.stringify(files.map((n, i) => ({ type: 'photo', media: `attach://p${i}`, ...(i === 0 ? { caption: `${head}\n(carrusel de fotos para TikTok)` } : {}) }))));
  files.forEach((n, i) => f.append(`p${i}`, new Blob([fs.readFileSync(path.join(media, n))]), n));
  await api('sendMediaGroup', f);
} else {
  const f = new FormData();
  f.append('chat_id', CHAT); f.append('caption', head); f.append('supports_streaming', 'true');
  f.append('video', new Blob([fs.readFileSync(media)]), path.basename(media));
  await api('sendVideo', f);
}
const t = new FormData(); t.append('chat_id', CHAT); t.append('text', text);
await api('sendMessage', t);
console.log('OK sent to Telegram');
