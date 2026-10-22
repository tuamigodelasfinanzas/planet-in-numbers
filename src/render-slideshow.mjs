// Turns a carousel (7 slides 1080x1350) into a vertical Short (1080x1920) for YouTube and TikTok:
// slides inside the safe zone, push transitions, music + whooshes, a voice hook and a closing question.
// Usage: node src/render-slideshow.mjs <item.json> <slides dir> <out.mp4>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { C } from './brand.mjs';
import { browser, pageHTML } from './assets.mjs';
import { tts, voiceOn } from './voice.mjs';
import { slideVoices } from './carousel-voice.mjs';

const [itemFile, slidesDir, outFile = 'out/reel.mp4'] = process.argv.slice(2);
const item = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FPS = Number(process.env.PIN_FPS || 30);
const work = path.resolve(path.dirname(outFile), 'work-slides-' + item.id);
fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
const files = fs.readdirSync(slidesDir).filter(f => f.endsWith('.jpg')).sort();
if (files.length < 3) throw new Error('Not enough slides');

// ---------- what the voice says: one line per slide, in the order things appear ----------
const lines = slideVoices(item);
const clips = [], vd = files.map(() => 0);
if (voiceOn()) {
  try { lines.forEach((l, i) => { if (!l) return; const f = path.join(work, `v${i}.mp3`); vd[i] = tts(l, f); clips.push({ f, slide: i }); }); }
  catch (e) { console.warn('::warning::voice-over failed, video without voice: ' + e.message); clips.length = 0; vd.fill(0); }
}
const durs = files.map((_, i) => Math.max(i === 0 ? 2.6 : 3.0, vd[i] ? vd[i] + 0.7 : 0));
const starts = []; { let a = 0; for (const d of durs) { starts.push(a); a += d; } }
const total = durs.reduce((a, b) => a + b, 0);
console.log('Slides:', durs.map(d => d.toFixed(1)).join(' + '), '=', total.toFixed(1), 's');

// ---------- frames ----------
const X0 = 80, X1 = 920, W = X1 - X0, H = Math.round(W * 1350 / 1080), TOP = 372;
const imgs = files.map(f => `data:image/jpeg;base64,${fs.readFileSync(path.join(slidesDir, f)).toString('base64')}`);
// the slides already carry the logo and the handle: outside them only the progress bar
const body = `<div style="position:absolute;inset:0;background:radial-gradient(120% 60% at 50% 0%, ${C.card} 0%, ${C.bg} 70%)"></div>
  <div style="position:absolute;left:${X0}px;width:${W}px;top:318px;height:8px;border-radius:4px;background:${C.line}"><div id="pg" style="height:100%;width:0;border-radius:4px;background:${C.accent}"></div></div>
  <div id="stage" style="position:absolute;left:${X0}px;top:${TOP}px;width:${W}px;height:${H}px;overflow:hidden;border-radius:28px;box-shadow:0 24px 60px rgba(0,0,0,.45)">
    ${imgs.map((s, i) => `<img id="s${i}" src="${s}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0">`).join('')}</div>`;
const b = await browser();
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(pageHTML(1080, 1920, body));
await page.evaluate('document.fonts.ready');
await page.evaluate(([starts, total]) => {
  const ease = x => (x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3));
  const S = [...document.querySelectorAll('#stage img')], pg = document.getElementById('pg');
  window.frame = t => {
    pg.style.width = `${Math.min(100, (t / total) * 100)}%`;
    let k = 0; while (k + 1 < starts.length && t >= starts[k + 1]) k++;
    S.forEach((im, i) => {
      if (i === k) {
        const p = k === 0 ? 1 : ease((t - starts[k]) / 0.38);                 // push in from the right
        const z = 1 + 0.025 * Math.min(1, (t - starts[k]) / 3);                // slow zoom, never a frozen frame
        im.style.opacity = 1; im.style.transform = `translateX(${(1 - p) * 100}%) scale(${z})`;
      } else if (i === k - 1 && t - starts[k] < 0.38) {
        const p = ease((t - starts[k]) / 0.38);
        im.style.opacity = 1; im.style.transform = `translateX(${-p * 35}%) scale(1.025)`;
      } else im.style.opacity = 0;
    });
  };
}, [starts, total]);
const N = Math.ceil(total * FPS);
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), path.join(work, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let k = 0; k < N; k++) {
  await page.evaluate(t => window.frame(t), k / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end(); await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
await b.close();

// ---------- sound: music ducked under the voice + a whoosh on every slide ----------
const mood = item.series === 'versus' ? 'epic' : item.series === 'week' ? 'calm' : 'upbeat';
const music = path.join(ROOT, 'assets/music', `${mood}-${1 + Math.floor(Math.random() * 2)}.mp3`);
const sfx = [{ t: 0.02, k: 'boom', v: 0.8 }, ...starts.slice(1).map(s => ({ t: Math.max(0, s - 0.12), k: 'whoosh', v: 0.6 }))];
const a = ['-y', '-v', 'error', '-i', path.join(work, 'video.mp4'), '-stream_loop', '-1', '-i', music];
clips.forEach(c => a.push('-i', c.f)); sfx.forEach(s => a.push('-i', path.join(ROOT, 'assets/sfx', s.k + '.wav')));
const f = [], nv = clips.length;
clips.forEach((c, j) => f.push(`[${j + 2}:a]adelay=${Math.round((starts[c.slide] + 0.3) * 1000)}:all=1,volume=1.6[v${j}]`));
sfx.forEach((s, j) => f.push(`[${j + 2 + nv}:a]adelay=${Math.round(s.t * 1000)}:all=1,volume=${s.v}[x${j}]`));
f.push(`[1:a]volume=0.42,afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, total - 1.6).toFixed(2)}:d=1.6[m]`);
const xs = sfx.map((_, j) => `[x${j}]`).join('');
if (nv) {
  f.push(`${clips.map((_, j) => `[v${j}]`).join('')}amix=inputs=${nv}:normalize=0,asplit=2[vo][key]`);
  f.push('[m][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]');
  f.push(`[md][vo]${xs}amix=inputs=${2 + sfx.length}:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`);
} else f.push(`[m]${xs}amix=inputs=${1 + sfx.length}:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5,aresample=48000[a]`);
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
execFileSync('ffmpeg', [...a, '-filter_complex', f.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-t', total.toFixed(2), '-movflags', '+faststart', outFile]);

// text for YouTube/TikTok: the carousel caption without "swipe" instructions
item.videoCaption = item.caption.replace(/[^\n]*\bSwipe\b[^\n]*➡️\s*/g, l => l.replace(/Swipe[^➡]*➡️\s*/, '')).replace(/\n{3,}/g, '\n\n');
fs.writeFileSync(itemFile, JSON.stringify(item, null, 1));
console.log(`OK ${outFile} (${total.toFixed(1)} s)`);
