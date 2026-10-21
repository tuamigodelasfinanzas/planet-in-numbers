// Channel intro (vertical 1080x1920): shouted name + what the account is about, with real data on screen.
// Usage: node tools/intro/render-intro.mjs out/intro.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { C, HANDLE } from '../../src/brand.mjs';
import { browser, pageHTML, logo, EMOJI_FONT, mapSVG, MAP } from '../../src/assets.mjs';
import { latestOf, latest, bigCountries } from '../../src/wb.mjs';
import { show } from '../../src/fmt.mjs';
import { probe, clean } from '../../src/voice.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const out = path.resolve(process.argv[2] || 'out/intro.mp4');
const work = path.join(path.dirname(out), 'work-intro');
fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
const FPS = Number(process.env.PIN_FPS || 30);
const VOZ = String(process.env.PIN_VOZ ?? 'true') !== 'false';

// ---------- real data for the screens ----------
const big = await bigCountries(1e6);
const rich = (await latest('NY.GDP.PCAP.CD')).filter(r => big.has(r.iso3)).sort((a, b) => b.value - a.value).slice(0, 5);
const rows = rich.map(r => ({ flag: r.flag, name: r.name, text: show(r.value, 'usd'), v: r.value / rich[0].value }));
const happy = (await latestOf({ src: 'owid', slug: 'happiness-cantril-ladder' }, 6)).filter(r => big.has(r.iso3)).sort((a, b) => b.value - a.value);
const lit = {}; happy.forEach((r, i) => { lit[r.iso3] = 1 - i / (happy.length - 1); });
let mapLit = await mapSVG(lit, 980);
// countries light up from the happiest to the least happy
mapLit = mapLit.replace(/data-t="([\d.]+)"/g, (m, t) => `${m} data-d="${(1 - Number(t)).toFixed(3)}"`);
const deco = {}; ['USA', 'BRA', 'IND', 'CHN', 'AUS', 'ZAF', 'ESP', 'JPN', 'NGA', 'CAN', 'MEX', 'RUS', 'FRA', 'IDN', 'ARG', 'EGY'].forEach(i => { deco[i] = 1; });
const mapBg = (await mapSVG(deco, 1600)).replace(/data-c="([^"]+)" fill="[^"]+"/g, 'fill="$1"');

// ---------- voice ----------
// announcer (shouts the name) + the brand voice (explains)
function tts(text, file, { voice = 'en-US-AndrewNeural', rate = '+6%', pitch = '+0Hz' } = {}) {
  const tf = path.join(work, path.basename(file) + '.txt'); fs.writeFileSync(tf, clean(text));
  for (let i = 0; i < 3; i++) {
    try { execFileSync('edge-tts', ['--voice', voice, `--rate=${rate}`, `--pitch=${pitch}`, '--file', tf, '--write-media', file], { stdio: 'pipe' }); if (fs.statSync(file).size > 1000) return probe(file); } catch {}
  }
  throw new Error('edge-tts failed for: ' + text);
}
// stadium shout: louder, compressed, a short arena echo
function shoutFx(inp, outp) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', inp, '-af', 'highpass=f=90,acompressor=threshold=0.05:ratio=6:attack=5:release=120,volume=2.2,aecho=0.8:0.6:90|180:0.35|0.18,alimiter=limit=0.95', outp]);
  return probe(outp);
}
const clips = []; // {file, at}
const SHOUT = { voice: 'en-US-GuyNeural', rate: '-8%', pitch: '+6Hz' };
const say = (text, opts) => { if (!VOZ) return Math.max(1.4, text.split(' ').length * 0.32); const f = path.join(work, `v${clips.length}-${Math.random().toString(36).slice(2, 6)}.mp3`); const d = tts(text, f, opts); return { f, d }; };

const scenes = [];
// 1) the name, shouted word by word
{
  const words = ['Planet!', 'In!', 'Numbers!'], shown = ['PLANET', 'IN', 'NUMBERS'];
  let t = 0.45; const ws = [];
  for (const [i, w] of words.entries()) {
    let d = 0.55;
    if (VOZ) { const raw = path.join(work, `shout${i}.mp3`), fx = path.join(work, `shout${i}-fx.wav`); tts(w, raw, SHOUT); d = shoutFx(raw, fx); clips.push({ f: fx, at: t, vol: 1.25 }); }
    ws.push({ text: shown[i], at: t }); t += Math.min(d, 0.95) + 0.12;
  }
  scenes.push({ type: 'shout', words: ws, dur: t + 0.7 });
}
// 2) the rest, each scene as long as its sentence (+ a beat)
const plan = [
  { type: 'line', kicker: 'THE WORLD IN DATA', html: `The whole world, <span style="color:${C.accent}">ranked</span>.`, say: 'The whole world, ranked in numbers.' },
  { type: 'ranking', kicker: 'EVERY DAY', title: 'A new ranking', rows, say: 'Every day, a brand new ranking.' },
  { type: 'map', kicker: 'MAPS', title: 'See how different the world is', say: 'Maps that show how different the world really is.' },
  { type: 'quiz', kicker: 'QUIZZES', title: 'Guess the country', flags: ['🇯🇵', '🇧🇷', '🇳🇴'], say: 'Quizzes to test what you know.' },
  { type: 'versus', kicker: 'BATTLES', title: 'Country vs country', a: '🇺🇸', b: '🇨🇳', say: 'And epic battles. Country versus country!' },
  { type: 'line', kicker: 'YOUR TURN', html: `Where does <span style="color:${C.accent}">YOUR</span> country rank?`, say: 'So... where does YOUR country rank?' },
  { type: 'outro', say: 'Follow Planet in Numbers!', shout: true },
];
const MIN = { line: 2.2, ranking: 3.0, map: 3.2, quiz: 2.6, versus: 2.6, outro: 3.6 };
for (const p of plan) {
  const start = scenes.reduce((a, s) => a + s.dur, 0);
  let d = Math.max(1.4, p.say.split(' ').length * 0.32);
  if (VOZ) {
    const raw = path.join(work, `say${scenes.length}.mp3`);
    d = tts(p.say, raw, p.shout ? { ...SHOUT, rate: '-2%' } : { rate: '+8%' });
    let f = raw; if (p.shout) { f = raw.replace('.mp3', '-fx.wav'); d = shoutFx(raw, f); }
    clips.push({ f, at: start + 0.25, vol: p.shout ? 1.2 : 1.6 });
  }
  scenes.push({ ...p, dur: Math.max(MIN[p.type] || 2.2, d + 0.55) });
}
const total = scenes.reduce((a, s) => a + s.dur, 0);
const starts = []; { let a = 0; for (const s of scenes) { starts.push(a); a += s.dur; } }
console.log('Intro:', scenes.map(s => `${s.type} ${s.dur.toFixed(1)}`).join(' | '), '=', total.toFixed(1), 's');

// ---------- frames ----------
const b = await browser();
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(pageHTML(1080, 1920));
await page.evaluate(d => { window.DATA = d; }, { scenes, colors: C, emoji: EMOJI_FONT, handle: HANDLE, logo: logo(380), map: mapBg, mapLit });
await page.addScriptTag({ path: path.join(ROOT, 'tools/intro/stage-intro.js') });
await page.waitForFunction('window.ready === true');
await page.evaluate('document.fonts.ready');
const N = Math.ceil(total * FPS);
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS), path.join(work, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let k = 0; k < N; k++) {
  await page.evaluate(t => window.frame(t), k / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (process.env.PIN_STILLS && k % Math.round(FPS * 0.75) === 0) fs.writeFileSync(path.join(work, `still-${String(k).padStart(5, '0')}.jpg`), buf);
}
ff.stdin.end(); await new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
await b.close();

// ---------- sound: epic music + effects on every hit + voices ----------
const sfx = [{ t: 0.02, k: 'boom', v: 1 }];
for (const w of scenes[0].words) sfx.push({ t: w.at, k: 'hit', v: 0.9 });
starts.slice(1).forEach((s, i) => sfx.push({ t: s - 0.22, k: 'whoosh', v: 0.8 }));
const ranking = scenes.findIndex(s => s.type === 'ranking'); rows.forEach((_, i) => sfx.push({ t: starts[ranking] + 0.15 + (rows.length - 1 - i) * 0.22, k: i === 0 ? 'pop' : 'tick', v: 0.8 }));
const quiz = scenes.findIndex(s => s.type === 'quiz'); [0, 1, 2].forEach(i => sfx.push({ t: starts[quiz] + 0.25 + i * 0.18, k: 'pop', v: 0.8 }));
const vs = scenes.findIndex(s => s.type === 'versus'); sfx.push({ t: starts[vs] + 0.3, k: 'hit', v: 0.9 });
const last = starts.at(-1); sfx.push({ t: last - 1.45, k: 'roll', v: 0.7 }, { t: last, k: 'hit', v: 1 });
const SFXD = path.join(ROOT, 'assets/sfx');
const music = path.join(ROOT, 'assets/music/epic-1.mp3');
const a = ['-y', '-v', 'error', '-i', path.join(work, 'video.mp4'), '-stream_loop', '-1', '-i', music];
clips.forEach(c => a.push('-i', c.f)); sfx.forEach(s => a.push('-i', path.join(SFXD, s.k + '.wav')));
const f = [];
const nv = clips.length;
clips.forEach((c, j) => f.push(`[${j + 2}:a]adelay=${Math.round(c.at * 1000)}:all=1,volume=${c.vol}[v${j}]`));
sfx.forEach((s, j) => f.push(`[${j + 2 + nv}:a]adelay=${Math.round(s.t * 1000)}:all=1,volume=${s.v}[x${j}]`));
f.push(`[1:a]volume=0.75,afade=t=in:st=0:d=0.2,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2[m]`);
if (nv) {
  f.push(`${clips.map((_, j) => `[v${j}]`).join('')}amix=inputs=${nv}:normalize=0,asplit=2[vo][key]`);
  f.push('[m][key]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=300[md]');
  f.push(`[md][vo]${sfx.map((_, j) => `[x${j}]`).join('')}amix=inputs=${2 + sfx.length}:duration=first:normalize=0,loudnorm=I=-13:TP=-1.2:LRA=9,aresample=48000[a]`);
} else f.push(`[m]${sfx.map((_, j) => `[x${j}]`).join('')}amix=inputs=${1 + sfx.length}:duration=first:normalize=0,loudnorm=I=-13:TP=-1.2,aresample=48000[a]`);
execFileSync('ffmpeg', [...a, '-filter_complex', f.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(starts.at(-1) + 1.5), '-i', out, '-frames:v', '1', '-q:v', '2', out.replace(/\.mp4$/, '.jpg')]);
console.log(`OK ${out} (${probe(out).toFixed(1)} s)`);
