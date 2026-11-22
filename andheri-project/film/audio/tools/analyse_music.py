"""Measure a music file: loudness, RMS per 2 s, section means, dominant pitch in the opening, rough tempo."""
import sys, json, pathlib, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L
p = sys.argv[1]; secs = [float(x) for x in sys.argv[2].split(',')] if len(sys.argv) > 2 else []
sr = 22050; x = L.pcm(p, sr)
dur = len(x) / sr
i, tp, lra = L.loudness(p)
print(f'{p}: {dur:.2f}s, {i} LUFS, {tp} dBTP, LRA {lra}')
blk = int(sr * 2)
rms = [20 * np.log10(np.sqrt(np.mean(x[k:k + blk] ** 2)) + 1e-9) for k in range(0, len(x), blk)]
print('RMS dBFS per 2 s:', ' '.join(f'{r:.0f}' for r in rms))
if secs:
    b = [0] + secs + [dur]
    for a, c in zip(b, b[1:]):
        seg = x[int(a * sr):int(c * sr)]
        print(f'  {a:6.1f}-{c:6.1f}: {20*np.log10(np.sqrt(np.mean(seg**2))+1e-9):6.1f} dBFS')
# first onset and the opening's dominant frequency
env = np.abs(x); thr = 10 ** (-45 / 20)
first = np.argmax(env > thr) / sr
seg = x[int(first * sr):int((first + 3) * sr)]
spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))); f = np.fft.rfftfreq(len(seg), 1 / sr)
band = (f > 25) & (f < 2000)
pk = f[band][np.argsort(spec[band])[-5:]][::-1]
print(f'first sound at {first:.2f}s; strongest partials in its first 3 s (Hz):', [round(v, 1) for v in pk])
# rough tempo from onset-strength autocorrelation (20 s to 100 s)
hop = 512; frames = np.array([np.sum(np.abs(x[k:k + 1024])) for k in range(0, len(x) - 1024, hop)])
on = np.maximum(0, np.diff(frames)); seg = on[int(20 * sr / hop):int(min(dur, 100) * sr / hop)]
seg = seg - seg.mean(); ac = np.correlate(seg, seg, 'full')[len(seg) - 1:]
lags = np.arange(len(ac)) * hop / sr; bpm = 60 / lags[1:]
ok = (bpm > 60) & (bpm < 160)
best = bpm[1:][ok[:len(bpm) - 1]] if False else None
cand = [(ac[k], 60 / lags[k]) for k in range(1, len(ac)) if 60 < 60 / lags[k] < 160]
cand.sort(reverse=True)
print('tempo candidates (BPM):', [round(c[1], 1) for c in cand[:4]])
