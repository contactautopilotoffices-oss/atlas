"""Bar grid and per-bar chroma for a music file (used to cut seamless loops and edits on bar lines)."""
import sys, pathlib, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L

def onset_env(x, sr, hop=256):
    n = 1024; win = np.hanning(n)
    frames = np.array([np.abs(np.fft.rfft(x[k:k + n] * win)) for k in range(0, len(x) - n, hop)])
    flux = np.maximum(0, np.diff(np.log1p(frames), axis=0)).sum(axis=1)
    return np.concatenate([[0], flux]), hop / sr

def grid(x, sr, bpm_lo=70, bpm_hi=90, t0=0, t1=None):
    env, dt = onset_env(x, sr)
    a, b = int(t0 / dt), int((t1 or len(x) / sr) / dt)
    e = env[a:b]
    best = None
    for bpm in np.arange(bpm_lo, bpm_hi, 0.05):
        beat = 60 / bpm
        for ph in np.arange(0, beat, 0.01):
            idx = ((ph + np.arange(0, (b - a) * dt - beat, beat)) / dt).astype(int)
            s = e[idx].mean()
            if best is None or s > best[0]: best = (s, bpm, ph + t0)
    return best[1], best[2]

def chroma(seg, sr):
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / sr)
    m = (f > 60) & (f < 2000)
    pc = np.round(12 * np.log2(f[m] / 440.0)).astype(int) % 12
    c = np.bincount(pc, weights=sp[m], minlength=12)
    return c / (np.linalg.norm(c) + 1e-12)

if __name__ == '__main__':
    p = sys.argv[1]; sr = 22050; x = L.pcm(p, sr)
    t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; t1 = float(sys.argv[3]) if len(sys.argv) > 3 else None
    bpm, ph = grid(x, sr, t0=t0, t1=t1)
    beat = 60 / bpm; bar = 4 * beat
    print(f'bpm {bpm:.2f}, first beat at {ph:.2f}s, bar {bar:.3f}s')
    # find the downbeat phase among the 4 beats: the beat with the strongest low-frequency onsets
    env, dt = onset_env(x, sr)
    sc = []
    for k in range(4):
        st = ph + k * beat
        idx = ((st + np.arange(0, len(x) / sr - st - bar, bar)) / dt).astype(int)
        sc.append(env[idx].mean())
    db = ph + int(np.argmax(sc)) * beat
    db = db - bar * int(db / bar)
    if len(sys.argv) > 4: db = float(sys.argv[4])  # forced downbeat phase
    print('downbeat phase', round(db, 3), 'beat scores', [round(s, 2) for s in sc])
    bars = np.arange(db, len(x) / sr - bar, bar)
    C = np.array([chroma(x[int(b * sr):int((b + bar) * sr)], sr) for b in bars])
    rms = [20 * np.log10(np.sqrt(np.mean(x[int(b * sr):int((b + bar) * sr)] ** 2)) + 1e-9) for b in bars]
    names = 'A A# B C C# D D# E F F# G G#'.split()
    for i, (b, c, r) in enumerate(zip(bars, C, rms)):
        top = [names[j] for j in np.argsort(c)[-3:][::-1]]
        print(f'bar {i:2d} @ {b:6.2f}s {r:6.1f} dB  {"-".join(top)}')
    np.save('/private/tmp/claude-501/-Users-lohit-Downloads-Atlas/cc0f7fd1-64e8-4ee3-bd33-a14ee7e17bad/scratchpad/chroma.npy', C)
