// Instagram can't add music to a photo carousel through the API, but a carousel can hold videos:
// each slide becomes a short 1080x1350 video (slow zoom + the music, continuing from slide to slide + its voice line).
// Usage: node src/render-slide-videos.mjs <item.json> <slides dir> <out dir>   → out/01.mp4 … 07.mp4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { tts, voiceOn } from './voice.mjs';
import { slideVoices } from './carousel-voice.mjs';

const [itemFile, slidesDir, outDir] = process.argv.slice(2);
const item = JSON.parse(fs.readFileSync(itemFile, 'utf8'));
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
fs.mkdirSync(outDir, { recursive: true });
const work = path.join(outDir, 'work'); fs.mkdirSync(work, { recursive: true });
const files = fs.readdirSync(slidesDir).filter(f => f.endsWith('.jpg')).sort();
const lines = slideVoices(item);
const mood = item.series === 'versus' ? 'epic' : item.series === 'week' ? 'calm' : 'upbeat';
const music = path.join(ROOT, 'assets/music', `${mood}-${1 + (item.id.length % 2)}.mp3`);
let offset = 0;
for (const [i, f] of files.entries()) {
  let vf = null, vd = 0;
  if (voiceOn() && lines[i]) { try { vf = path.join(work, `v${i}.mp3`); vd = tts(lines[i], vf); } catch (e) { console.warn('::warning::voice failed: ' + e.message); vf = null; } }
  const d = Math.max(4, vd ? vd + 1.2 : 0), n = Math.round(d * 30);
  const out = path.join(outDir, f.replace('.jpg', '.mp4'));
  const a = ['-y', '-v', 'error', '-loop', '1', '-framerate', '30', '-i', path.join(slidesDir, f), '-ss', offset.toFixed(2), '-stream_loop', '-1', '-i', music];
  if (vf) a.push('-i', vf);
  // slow zoom (rendered at 2x so it doesn't shimmer); music continues where the previous slide left it
  const fc = [`[0:v]scale=2160:2700,zoompan=z='1+0.04*on/${n}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350:fps=30,format=yuv420p[v]`,
    `[1:a]volume=${vf ? 0.5 : 0.8},afade=t=in:st=0:d=0.25,afade=t=out:st=${(d - 0.35).toFixed(2)}:d=0.35[m]`];
  if (vf) fc.push(`[2:a]adelay=300:all=1,volume=1.7,asplit=2[vo][k]`, '[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]', '[md][vo]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5,aresample=48000[a]');
  else fc.push('[m]loudnorm=I=-14:TP=-1.5,aresample=48000[a]');
  execFileSync('ffmpeg', [...a, '-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]', '-t', d.toFixed(2), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-b:v', '3500k', '-maxrate', '4500k', '-bufsize', '7000k', '-g', '30', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out]);
  offset += d;
  console.log(`${path.basename(out)}: ${d.toFixed(1)} s${vf ? ' + voice' : ''}`);
}
fs.rmSync(work, { recursive: true, force: true });
