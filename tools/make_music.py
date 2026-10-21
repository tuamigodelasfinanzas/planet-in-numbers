"""Original background music (no copyright), seamless loops, several moods.
Usage: python3 tools/make_music.py assets/music   (needs numpy + ffmpeg)
Moods: upbeat, epic, calm, tense, quiz (2 tracks each)."""
import sys, os, subprocess, wave
import numpy as np

SR = 48000
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def env(n, a, r):
    e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e

def track(bpm, chords, bars, seed, style):
    rng = np.random.default_rng(seed)
    beat = 60 / bpm; bar = 4 * beat; N = int(SR * bar * bars)
    mix = np.zeros((N, 2))
    def add(sig, start, pan=0.5, g=1.0):
        i = int(start * SR); idx = (np.arange(len(sig)) + i) % N
        mix[idx, 0] += sig * (1 - pan) * g; mix[idx, 1] += sig * pan * g
    def pad(m, dur, bright=0.35):
        n = int(dur * SR); t = np.arange(n) / SR
        s = sum(np.sin(2 * np.pi * hz(m) * (1 + d) * t + p) for d, p in [(0, 0), (0.004, 1), (-0.004, 2)])
        s += bright * np.sin(2 * np.pi * hz(m + 12) * t)
        return s * env(n, 0.6, 1.0) * 0.045
    def pluck(m, dur=0.6, g=0.09):
        n = int(dur * SR); t = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * hz(m) * t)) * 0.25 + np.sin(2 * np.pi * hz(m) * t)
        return s * np.exp(-7 * t) * g
    def bass(m, dur):
        n = int(dur * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(4 * np.pi * hz(m) * t)) * env(n, 0.01, 0.2) * 0.22
    def kick(g=0.34):
        n = int(0.3 * SR); t = np.arange(n) / SR; f = 120 * np.exp(-16 * t) + 45
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-10 * t) * g
    def snare():
        n = int(0.18 * SR); x = rng.standard_normal(n); return x * np.exp(-22 * np.arange(n) / SR) * 0.07
    def hat(g=0.045):
        n = int(0.05 * SR); x = rng.standard_normal(n); x = x - np.concatenate([[0], x[:-1]]) * 0.95
        return x * np.exp(-80 * np.arange(n) / SR) * g
    def tick():
        n = int(0.04 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * 1800 * t) * np.exp(-90 * t) * 0.05

    for b in range(bars):
        root, ch = chords[b % len(chords)]; t0 = b * bar
        for m in ch: add(pad(m, bar + 0.8, 0.5 if style == 'epic' else 0.3), t0, 0.35 if m % 2 else 0.65)
        if style in ('upbeat', 'quiz'):
            for k in range(4): add(bass(root, beat * 0.8), t0 + k * beat)
            pat = [0, 1, 2, 1, 2, 1, 0, 2]
            for k, p in enumerate(pat): add(pluck(ch[p] + 12, g=0.07 if style == 'quiz' else 0.08), t0 + k * beat / 2, 0.3 + 0.4 * (k % 2))
            for k in range(4): add(kick(), t0 + k * beat)
            for k in (1, 3): add(snare(), t0 + k * beat)
            for k in range(8): add(hat(), t0 + k * beat / 2 + (beat / 4 if style == 'upbeat' else 0), 0.6)
            if style == 'quiz':
                for k in range(8): add(tick(), t0 + k * beat / 2, 0.7)
        elif style == 'epic':
            add(bass(root - 12, beat * 1.9), t0); add(bass(root - 12, beat * 1.9), t0 + 2 * beat)
            for k in range(8): add(pluck(ch[k % 3] + 12 + (12 if k % 4 == 3 else 0), 0.5, 0.06), t0 + k * beat / 2)
            for k in (0, 2, 2.5): add(kick(0.4), t0 + k * beat)
            add(snare(), t0 + 1 * beat); add(snare(), t0 + 3 * beat)
            for k in range(16): add(hat(0.03), t0 + k * beat / 4, 0.6)
        elif style == 'calm':
            add(bass(root, bar * 0.9), t0)
            for k in range(4): add(pluck(ch[(k * 2) % 3] + 24, 1.2, 0.05), t0 + k * beat, 0.3 + 0.4 * (k % 2))
            for k in (0, 2): add(kick(0.18), t0 + k * beat)
        elif style == 'tense':
            for k in range(8): add(bass(root, beat * 0.4), t0 + k * beat / 2)
            add(pluck(ch[2] + 12, 1.5, 0.06), t0); add(pluck(ch[1] + 12, 1.5, 0.06), t0 + 2 * beat)
            for k in range(4): add(kick(0.3), t0 + k * beat)
            for k in range(16): add(hat(0.03), t0 + k * beat / 4, 0.6)
    mix /= np.max(np.abs(mix)); mix *= 0.8
    return mix

Am = (45, [57, 60, 64]); F = (41, [53, 57, 60]); C = (48, [55, 60, 64]); G = (43, [55, 59, 62])
Dm = (50, [57, 62, 65]); Em = (52, [55, 59, 64]); Bb = (46, [53, 58, 62]); E = (40, [56, 59, 64])
TRACKS = {
    'upbeat-1': (112, [C, G, Am, F], 16, 1, 'upbeat'),
    'upbeat-2': (118, [F, C, G, Am], 16, 2, 'upbeat'),
    'epic-1': (96, [Am, F, C, G], 16, 3, 'epic'),
    'epic-2': (100, [Dm, Bb, F, C], 16, 4, 'epic'),
    'calm-1': (84, [C, Am, F, G], 12, 5, 'calm'),
    'calm-2': (80, [F, C, Dm, Bb], 12, 6, 'calm'),
    'tense-1': (100, [Am, Am, F, E], 16, 7, 'tense'),
    'tense-2': (104, [Dm, Dm, Bb, Am], 16, 8, 'tense'),
    'quiz-1': (120, [C, Am, F, G], 16, 9, 'quiz'),
    'quiz-2': (124, [G, Em, C, Am], 16, 10, 'quiz'),
}
out = sys.argv[1] if len(sys.argv) > 1 else 'assets/music'
os.makedirs(out, exist_ok=True)
for name, (bpm, chords, bars, seed, style) in TRACKS.items():
    mix = track(bpm, chords, bars, seed, style)
    pcm = (mix * 32767).astype(np.int16); wav = os.path.join(out, name + '.wav')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-b:a', '160k', os.path.join(out, name + '.mp3')], check=True)
    os.remove(wav); print('ok', name)
