#!/usr/bin/env python3
"""
Synthesizes a 57.0-second stereo Nu-Funk / Upbeat SaaS Promo Soundtrack
(inspired by "Feelin' Lucky Now" - Sonny Cleveland) + synchronized UI Motion
SFX (whooshes, avatar pops, cursor clicks, sparkle chimes) for the Supahub ad.
"""
import wave
import numpy as np

SR = 44100
DUR = 57.0
N = int(SR * DUR)
t = np.arange(N, dtype=np.float64) / SR

left = np.zeros(N, dtype=np.float64)
right = np.zeros(N, dtype=np.float64)

BPM = 116.0
beat_dur = 60.0 / BPM
total_beats = int(DUR / beat_dur)

# 1. Upbeat Funky Drum Groove (Kick, Snare/Clap, 16th Hi-Hats)
rng = np.random.default_rng(42)
noise = rng.standard_normal(N)

for b in range(total_beats):
    bt = b * beat_dur
    idx0 = int(bt * SR)
    if idx0 >= N:
        break
    # Kick on every beat + funky syncopated ghost kicks
    for k_off, k_amp in [(0.0, 0.34), (0.75 * beat_dur if b % 2 == 1 else -1.0, 0.16)]:
        if k_off < 0:
            continue
        ki = int((bt + k_off) * SR)
        kl = int(0.18 * SR)
        if ki + kl < N:
            kt = np.arange(kl) / SR
            freq = 52.0 + 95.0 * np.exp(-kt * 38.0)
            phase = 2.0 * np.pi * np.cumsum(freq) / SR
            kick = np.sin(phase) * np.exp(-kt * 16.0) * k_amp
            left[ki:ki+kl] += kick
            right[ki:ki+kl] += kick

    # Crisp Snare / Funk Clap on beats 1, 3 (0-indexed)
    if b % 2 == 1:
        sl = int(0.14 * SR)
        if idx0 + sl < N:
            st = np.arange(sl) / SR
            body = np.sin(2.0 * np.pi * 185.0 * st) * np.exp(-st * 28.0) * 0.12
            snap = noise[idx0:idx0+sl] * np.exp(-st * 24.0) * 0.18
            left[idx0:idx0+sl] += body + snap * 1.05
            right[idx0:idx0+sl] += body + snap * 0.95

    # 16th-note Hi-Hats
    for sub in range(4):
        hi = int((bt + sub * 0.25 * beat_dur) * SR)
        hl = int(0.045 * SR)
        if hi + hl < N:
            ht = np.arange(hl) / SR
            amp = 0.065 if sub == 2 else (0.045 if sub == 0 else 0.025)
            hh = (noise[hi:hi+hl] - np.roll(noise[hi:hi+hl], 1)) * np.exp(-ht * 65.0) * amp
            left[hi:hi+hl] += hh * 0.9
            right[hi:hi+hl] += hh * 1.1

# 2. Groovy Nu-Funk Bassline + Warm Electric Piano / Brass Chords
# Progression: F#m7 -> B9 -> EMaj7 -> C#7
chords = [
    (92.50, [185.00, 220.00, 277.18, 329.63]), # F#m7
    (123.47,[246.94, 311.13, 369.99, 440.00]), # B9
    (82.41, [164.81, 207.65, 246.94, 311.13]), # EMaj7
    (69.30, [138.59, 174.61, 207.65, 246.94]), # C#7
]

for b in range(total_beats):
    bt = b * beat_dur
    bar = (b // 2) % 4
    root_f, chord_fs = chords[bar]
    # Funky 8th-note bass plucks
    for sub, f_mult in [(0.0, 1.0), (0.5, 1.0), (0.75, 1.5 if b % 2 == 1 else 1.0)]:
        bi = int((bt + sub * beat_dur) * SR)
        bl = int(0.22 * SR)
        if bi + bl < N:
            lt = np.arange(bl) / SR
            bf = root_f * f_mult
            sig = (np.sin(2*np.pi*bf*lt) + 0.45*np.sin(4*np.pi*bf*lt)*np.exp(-lt*14.0)) * np.exp(-lt*9.0) * 0.16
            left[bi:bi+bl] += sig
            right[bi:bi+bl] += sig

    # Syncopated Rhodes/Brass chord stabs
    if b % 2 == 0 or b % 4 == 3:
        ci = int((bt + (0.25 if b % 4 == 3 else 0.0) * beat_dur) * SR)
        cl = int(0.38 * SR)
        if ci + cl < N:
            lt = np.arange(cl) / SR
            env = (1.0 - np.exp(-lt * 80.0)) * np.exp(-lt * 6.5) * 0.055
            c_sig_l = np.zeros(cl)
            c_sig_r = np.zeros(cl)
            for idx_f, cf in enumerate(chord_fs):
                tone = np.sin(2*np.pi*cf*lt) + 0.25*np.sin(4*np.pi*cf*lt)*np.exp(-lt*10.0)
                if idx_f % 2 == 0:
                    c_sig_l += tone
                    c_sig_r += tone * 0.7
                else:
                    c_sig_l += tone * 0.7
                    c_sig_r += tone
            left[ci:ci+cl] += c_sig_l * env
            right[ci:ci+cl] += c_sig_r * env

# 3. Synchronized Motion-Design SFX (Whooshes, Avatar Pops, Cursor Clicks, Sparkle Chimes)
def add_whoosh(t_sec, dur=0.36, amp=0.14):
    i0 = int(t_sec * SR)
    ln = int(dur * SR)
    if i0 < 0 or i0 + ln >= N:
        return
    lt = np.arange(ln) / SR
    env = np.sin(np.pi * lt / dur) ** 1.8 * amp
    f_sweep = 180.0 + 420.0 * np.sin(np.pi * lt / dur)
    phase = 2.0 * np.pi * np.cumsum(f_sweep) / SR
    w_sig = (0.5 * np.sin(phase) + 0.5 * noise[i0:i0+ln]) * env
    # Simple lowpass smoothing on noise
    w_sig = np.convolve(w_sig, np.ones(12)/12.0, mode="same")
    pan = np.linspace(0.3, 0.7, ln)
    left[i0:i0+ln] += w_sig * (1.0 - pan) * 1.4
    right[i0:i0+ln] += w_sig * pan * 1.4

def add_pop_chime(t_sec, freq=660.0, amp=0.14):
    i0 = int(t_sec * SR)
    ln = int(0.18 * SR)
    if i0 < 0 or i0 + ln >= N:
        return
    lt = np.arange(ln) / SR
    f_curve = freq * (1.0 + 0.25 * np.exp(-lt * 45.0))
    phase = 2.0 * np.pi * np.cumsum(f_curve) / SR
    sig = (np.sin(phase) + 0.35 * np.sin(2.0 * phase)) * np.exp(-lt * 22.0) * amp
    left[i0:i0+ln] += sig
    right[i0:i0+ln] += sig

def add_click(t_sec):
    i0 = int(t_sec * SR)
    ln = int(0.06 * SR)
    if i0 < 0 or i0 + ln >= N:
        return
    lt = np.arange(ln) / SR
    sig = np.sin(2.0 * np.pi * 1450.0 * lt) * np.exp(-lt * 85.0) * 0.22
    left[i0:i0+ln] += sig
    right[i0:i0+ln] += sig
    add_pop_chime(t_sec + 0.03, 880.0, 0.12)

# Scene transition whooshes + Apple-style crystal shimmer on all 18 3-second shot cuts
shot_cuts = [0.10, 2.8, 5.8, 8.8, 11.8, 14.8, 17.8, 20.8, 23.8, 26.8, 29.8, 32.8, 35.8, 38.8, 41.8, 44.8, 47.8, 50.8, 53.8]
for idx_w, tw in enumerate(shot_cuts):
    add_whoosh(tw - 0.14, dur=0.38, amp=0.16)
    add_pop_chime(tw + 0.06, 587.33 if idx_w % 2 == 0 else 783.99, 0.09)

# Avatar & widget pop chimes across the 19 shots
for idx, tp in enumerate([1.0, 2.95, 3.08, 3.20, 3.32, 9.28, 12.48, 27.18, 33.05, 33.18, 33.30, 33.42, 45.20, 54.18]):
    add_pop_chime(tp, 520.0 + (idx % 6) * 65.0, 0.13)

# Cursor click & UI highlight chimes
for tc in [12.55, 18.65, 21.68, 30.58, 37.60, 40.00, 48.65]:
    add_click(tc)

# Finale shimmering chord at t=53.8s ("⚡ Supahub")
fi = int(53.8 * SR)
fl = N - fi
if fl > 0:
    lt = np.arange(fl) / SR
    f_env = (1.0 - np.exp(-lt * 18.0)) * np.exp(-lt * 1.1) * 0.11
    for f_c in [440.0, 554.37, 659.25, 880.0, 1108.73]:
        tone = np.sin(2.0 * np.pi * f_c * lt) * f_env
        left[fi:] += tone
        right[fi:] += tone

# Smooth fade-in and fade-out
fade_in = np.minimum(1.0, t / 0.25)
fade_out = np.minimum(1.0, (DUR - t) / 0.8)
env_master = fade_in * fade_out
left *= env_master
right *= env_master

# Soft limiter & normalize
peak = max(np.max(np.abs(left)), np.max(np.abs(right)), 1e-6)
left = np.tanh(left / peak * 1.25) * 0.88
right = np.tanh(right / peak * 1.25) * 0.88

stereo = np.empty((N, 2), dtype=np.int16)
stereo[:, 0] = (left * 32767.0).astype(np.int16)
stereo[:, 1] = (right * 32767.0).astype(np.int16)

with wave.open("Supahub_Soundtrack_57s.wav", "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(stereo.tobytes())

print("Saved Supahub_Soundtrack_57s.wav successfully!")
