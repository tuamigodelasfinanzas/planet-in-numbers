// Renders a reel: item.json -> MP4 (1080x1920, 30 fps, H.264 + AAC), with voice-over and music.
// Usage: node src/render-reel.mjs <item.json> <out.mp4>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { C, HANDLE } from './brand.mjs';
import { browser, pageHTML, logo, EMOJI_FONT, mapSVG, MAP } from './assets.mjs';
import { tts, probe, voiceOn } from './voice.mjs';
import { show } from './fmt.mjs';

const [itemFile, outFile = 'out/reel.mp4'] = process.argv.slice(2);
const item = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
const FPS = Number(process.env.PIN_FPS || 30);
const work = path.resolve(path.dirname(outFile), 'work-' + item.id);
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

// 1) voice: one clip per scene; each scene lasts as long as its voice (+ breathing room), never shorter than `min`
const durs = [], clips = [];
let useVoice = voiceOn();
for (const [i, s] of item.scenes.entries()) {
  let vd = 0;
  if (useVoice && s.say) {
    const f = path.join(work, `v${i}.mp3`);
    try { vd = tts(s.say, f); clips.push({ f, i }); } catch (e) { console.warn('::warning::voice-over failed, video without voice: ' + e.message); useVoice = false; clips.length = 0; }
  }
  const base = { hook: 3.2, rank: 11, winner: 4, race: 18, map: 11, stat: 8, clues: 10, countdown: 4, answer: 3, cta: 3.5 }[s.type] || 4;
  durs.push(Math.max(s.min || 0, base, vd ? vd + 0.9 : 0));
}
const total = durs.reduce((a, b) => a + b, 0);
console.log('Scenes:', durs.map(d => d.toFixed(1)).join(' + '), '=', total.toFixed(1), 's');

// 2) frames
const data = {
  item, durs, total, colors: C, handle: HANDLE, emoji: EMOJI_FONT,
  logo: logo(64), logoBig: logo(330), valW: 200,
  mapSVG: item.scenes.some(s => s.type === 'map') ? await mapSVG(item.scenes.find(s => s.type === 'map').values, 880) : '',
  mapLow: MAP.low, mapMid: MAP.mid, mapNone: MAP.none,
};
const b = await browser();
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(pageHTML(1080, 1920));
await page.evaluate(d => { window.DATA = d; }, data);
await page.evaluate(`window.DATA.fmtFn = (f) => (${String(showFn)})(f)`);
await page.addScriptTag({ path: path.join(ROOT, 'src/stage.js') });
await page.waitForFunction('window.ready === true');
await page.evaluate('document.fonts.ready');

const N = Math.ceil(total * FPS);
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2), path.join(work, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let k = 0; k < N; k++) {
  await page.evaluate(t => window.frame(t), k / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (k % (FPS * 5) === 0) process.stdout.write(`frame ${k}/${N}\n`);
  if (process.env.PIN_STILLS && k % Math.round(FPS * 1.5) === 0) fs.writeFileSync(path.join(work, `still-${String(k).padStart(5, '0')}.jpg`), buf);
}
ff.stdin.end();
await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
await b.close();

// 3) audio: music (ducked under the voice) + voice clips at the start of each scene
const music = pickMusic(item.music);
const starts = []; let acc = 0; for (const d of durs) { starts.push(acc); acc += d; }
const args = ['-y', '-v', 'error', '-i', path.join(work, 'video.mp4'), '-stream_loop', '-1', '-i', music];
clips.forEach(c => args.push('-i', c.f));
let filter;
if (clips.length) {
  const parts = clips.map((c, j) => `[${j + 2}:a]adelay=${Math.round((starts[c.i] + 0.35) * 1000)}:all=1,volume=1.6[s${j}]`);
  parts.push(`${clips.map((_, j) => `[s${j}]`).join('')}amix=inputs=${clips.length}:normalize=0,asplit=2[v][k]`);
  parts.push(`[1:a]volume=0.42,afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, total - 1.6)}:d=1.6[m]`);
  parts.push('[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]');
  parts.push('[md][v]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000[a]');
  filter = parts.join(';');
} else {
  filter = `[1:a]volume=0.8,afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, total - 1.6)}:d=1.6,loudnorm=I=-15:TP=-1.5,aresample=48000[a]`;
}
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
execFileSync('ffmpeg', [...args, '-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-t', total.toFixed(2), '-movflags', '+faststart', outFile], { stdio: 'inherit' });
// cover frame (for stories/telegram): the winner / answer / first scene at its end
// cover = the hook (title fully visible, no spoiler of the answer)
item.cover_ms = Math.round(Math.min(durs[0] * 0.75, 2.2) * 1000);
fs.writeFileSync(itemFile, JSON.stringify(item, null, 1));
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(item.cover_ms / 1000), '-i', outFile, '-frames:v', '1', '-q:v', '3', outFile.replace(/\.mp4$/, '.jpg')]);
if (!process.env.PIN_STILLS) fs.rmSync(work, { recursive: true, force: true });
console.log(`OK ${outFile} (${probe(outFile).toFixed(1)} s, voice: ${clips.length ? 'yes' : 'no'})`);

function pickMusic(mood) {
  const dir = path.join(ROOT, 'assets/music');
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
  const m = all.filter(f => f.startsWith((mood || 'upbeat') + '-'));
  const list = m.length ? m : all;
  return path.join(dir, list[Math.floor(Math.random() * list.length)]);
}
function showFn(f) {
  // tiny copy of fmt.show used inside the browser for the race counters
  const nf = d => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  const big = v => { const a = Math.abs(v); return a >= 1e12 ? [v / 1e12, 'T'] : a >= 1e9 ? [v / 1e9, 'B'] : a >= 1e6 ? [v / 1e6, 'M'] : a >= 1e3 ? [v / 1e3, 'K'] : [v, '']; };
  return v => {
    if (f === 'usd') return '$' + nf(0).format(v);
    if (f === 'usd_big') { const [n, s] = big(v); return '$' + nf(n >= 100 ? 0 : 1).format(n) + s; }
    if (f === 'num_big') { const [n, s] = big(v); return nf(s ? (n >= 100 ? 0 : 1) : 0).format(n) + s; }
    if (f === 'pct') return nf(v < 10 ? 1 : 0).format(v) + '%';
    if (f === 'years') return nf(1).format(v);
    return nf(f === 'per100' ? 0 : 1).format(v);
  };
}
void show;
