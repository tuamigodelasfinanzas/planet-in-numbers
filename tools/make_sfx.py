"""Original sound effects (no copyright) for the reels.
Usage: python3 tools/make_sfx.py assets/sfx   (needs numpy)"""
import sys, os, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(11)
out = sys.argv[1] if len(sys.argv) > 1 else 'assets/sfx'
os.makedirs(out, exist_ok=True)
t_ = lambda d: np.arange(int(d * SR)) / SR

def lp(x, a):  # one-pole low-pass, a in (0,1): smaller = darker
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y
def hp(x, a): return x - lp(x, a)
def save(name, x, stereo_width=0.0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    L = x; R = np.roll(x, int(stereo_width * SR)) if stereo_width else x
    pcm = (np.stack([L, R], 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(out, name + '.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('ok', name)

# tick: crisp, short, woody (each row of the countdown)
t = t_(0.06); tick = (np.sin(2*np.pi*1900*t) * 0.7 + np.sin(2*np.pi*3100*t) * 0.3) * np.exp(-90*t)
tick += hp(rng.standard_normal(len(t)), 0.3) * np.exp(-250*t) * 0.25
save('tick', tick)

# pop: bubbly upward blip (named rows, clues)
t = t_(0.14); f = 520 + 900 * (1 - np.exp(-30*t)); pop = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-24*t)
pop += np.sin(2*np.pi*np.cumsum(f*2)/SR) * np.exp(-40*t) * 0.25
save('pop', pop)

# whoosh: band-passed noise sweeping up then down (scene changes)
t = t_(0.55); n = rng.standard_normal(len(t)); env = np.sin(np.pi * np.clip(t/0.55, 0, 1)) ** 2
sweep = np.interp(t, [0, 0.3, 0.55], [0.03, 0.22, 0.05])
y = np.empty_like(n); acc = 0.0; acc2 = 0.0
for i, v in enumerate(n):
    a = sweep[i]; acc += a * (v - acc); acc2 += a * (acc - acc2); y[i] = acc - acc2 * 0.6
save('whoosh', y * env, stereo_width=0.004)

# roll: snare roll with crescendo, 1.4 s (before the reveal of #1)
d = 1.4; t = t_(d); roll = np.zeros(len(t))
k = 0.0
while k < d:
    rate = 14 + 22 * (k / d)              # hits per second speed up
    i = int(k * SR); m = min(len(t) - i, int(0.09 * SR)); tt = np.arange(m) / SR
    hit = hp(rng.standard_normal(m), 0.35) * np.exp(-38*tt) * (0.25 + 0.75 * (k/d) ** 1.6)
    hit += np.sin(2*np.pi*190*tt) * np.exp(-50*tt) * 0.3 * (0.3 + 0.7 * k/d)
    roll[i:i+m] += hit; k += 1 / rate
save('roll', roll, stereo_width=0.002)

# hit: the big reveal — deep boom + bright crash
t = t_(1.8)
f = 140 * np.exp(-9*t) + 46
boom = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-3.2*t)
crash = hp(rng.standard_normal(len(t)), 0.55) * np.exp(-2.6*t) * 0.45
shimmer = sum(np.sin(2*np.pi*fr*t + ph) for fr, ph in [(1046, 0), (1318, 1), (1568, 2), (2093, 3)]) * np.exp(-3.5*t) * 0.06
save('hit', boom * 1.1 + crash + shimmer, stereo_width=0.006)

# boom: softer impact for the first frame (attention grabber)
t = t_(0.9); f = 110 * np.exp(-12*t) + 50
boom2 = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-5*t) + hp(rng.standard_normal(len(t)), 0.5) * np.exp(-14*t) * 0.25
save('boom', boom2)

# clock: tick-tock for the quiz countdown
t = t_(0.12)
def block(fr): return (np.sin(2*np.pi*fr*t) + 0.4*np.sin(2*np.pi*fr*2.7*t)) * np.exp(-55*t)
save('clock', block(1250))
save('clock2', block(950))

# ding: correct-answer chime
t = t_(1.2); ding = sum(a * np.sin(2*np.pi*fr*t) * np.exp(-dk*t) for fr, a, dk in [(1318, 1, 3), (1976, .5, 4), (2637, .3, 5)])
save('ding', ding)
