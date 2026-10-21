// Story that announces the post of the day: 1080x1920 PNG (+ 15 s MP4 with music if ffmpeg is present)
// Usage: node src/render-story.mjs <item.json> <cover.jpg> <out.png> [post link]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { C, HANDLE, EMOJI, logoSVG } from './brand.mjs';
import { browser, pageHTML } from './assets.mjs';
import { esc } from './fmt.mjs';

const [itemFile, cover, out = 'story.png', link = ''] = process.argv.slice(2);
const item = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
const img = `data:image/jpeg;base64,${fs.readFileSync(cover).toString('base64')}`;
const isReel = item.kind === 'reel';
const Q = {
  guess: 'Can you guess the country? 🤔', top10: 'Is your country in the Top 10?', dollar100: 'How far does YOUR $100 go?',
  race: 'Did your country go up or down?', map: 'Find your country on the map 👀', stat: 'Did you expect this gap? 🤯',
  top20: 'Is your country on the list?', versus: 'Who wins? Pick a side 🥊', week: 'The week in numbers 🌍',
  stop: 'Stop the video! Where did you land? 🎰', hl: 'Higher or lower? Can you get 5/5? ⬆️⬇️', cup: 'World Cup of countries: VOTE 🏆',
}[item.series] || 'New ranking just dropped';
const emo = s => esc(s).replace(/(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*)/gu, `<span style="font-family:${EMOJI}">$1</span>`);
const cw = isReel ? 560 : 720, ch = isReel ? Math.round(cw * 16 / 9) : Math.round(cw * 1.25);

const body = `
  <div style="position:absolute;left:80px;right:80px;top:230px;display:flex;align-items:center;gap:18px">${logoSVG(80)}
    <div style="font-size:38px;font-weight:700">Planet in Numbers</div></div>
  <div style="position:absolute;left:80px;right:80px;top:350px;text-align:center">
    <div style="display:inline-block;background:${C.accent};color:${C.bg};border-radius:999px;padding:12px 36px;font-size:38px;font-weight:700;letter-spacing:.06em">${isReel ? 'NEW REEL' : 'NEW POST'}</div>
    <div style="font-size:66px;line-height:1.08;font-weight:700;margin-top:30px">${emo(Q)}</div></div>
  <div style="position:absolute;left:${(1080 - cw) / 2}px;top:${isReel ? 600 : 660}px;width:${cw}px;height:${ch}px;border-radius:36px;overflow:hidden;border:6px solid ${C.accent};box-shadow:0 30px 80px rgba(0,0,0,.5)">
    <img src="${img}" style="width:100%;height:100%;object-fit:cover"></div>
  <div style="position:absolute;left:80px;right:80px;top:${(isReel ? 600 : 660) + ch + 50}px;text-align:center">
    <div style="font-size:44px;font-weight:700">${link ? esc(link) : `Watch it on ${esc(HANDLE)} 👆`.replace('👆', '')}</div>
    <div style="font-size:34px;color:${C.muted};margin-top:12px">${link ? 'Tap the link sticker or visit the profile' : 'Tap the profile to watch'}</div></div>`;

const b = await browser();
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(pageHTML(1080, 1920, body));
await page.evaluate('document.fonts.ready');
await page.screenshot({ path: out });
await b.close();

try {
  const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
  const dir = path.join(ROOT, 'assets/music'); const tracks = fs.readdirSync(dir).filter(f => f.startsWith('calm-'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '30', '-t', '15', '-i', out, '-stream_loop', '-1', '-t', '15', '-i', path.join(dir, tracks[0]),
    '-vf', 'zoompan=z=\'min(1+0.0004*on,1.06)\':d=1:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':s=1080x1920:fps=30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', '-af', 'volume=0.55,afade=t=in:d=0.5,afade=t=out:st=13.5:d=1.5',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out.replace(/\.png$/, '.mp4')]);
  console.log('OK story video');
} catch (e) { console.warn('::warning::story video failed, image only: ' + String(e.message).slice(0, 200)); }
console.log('OK', out);
