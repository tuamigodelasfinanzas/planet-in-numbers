// English voice-over with edge-tts (free). Same calm pace in every video: never sped up to fit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const VOICE = process.env.PIN_VOICE || 'en-US-AndrewNeural';
export const RATE = '+4%';
export const voiceOn = () => String(process.env.PIN_VOZ ?? 'true') !== 'false';
export const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

export function clean(t) {
  return String(t ?? '')
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, '')
    .replace(/\$(\d)/g, '$1 dollars ').replace(/(\d)\s?%/g, '$1 percent').replace(/×/g, ' times')
    .replace(/\bvs\b/gi, 'versus').replace(/\s+/g, ' ').trim();
}

export function tts(text, file) {
  const tf = path.join(os.tmpdir(), `pin-tts-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(tf, clean(text));
  let err = '';
  for (let i = 0; i < 3; i++) {
    try {
      fs.rmSync(file, { force: true });
      execFileSync('edge-tts', ['--voice', VOICE, `--rate=${RATE}`, '--file', tf, '--write-media', file], { stdio: 'pipe' });
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) { fs.rmSync(tf, { force: true }); return probe(file); }
    } catch (e) { err = String(e.stderr || e.message).slice(-200); }
  }
  fs.rmSync(tf, { force: true });
  throw new Error('edge-tts failed: ' + err);
}
