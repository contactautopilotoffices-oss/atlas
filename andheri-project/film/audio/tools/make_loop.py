"""Cut the 60 s seamless ambient loop for the property-selection screen out of music/loop_source_v1.mp3.

The source is 80 BPM (a bar is exactly 3.000 s, downbeats at 0.02 s + n x 3 s). Its steady part is bars 6-19; the
loop is 20 bars = 60.000 s: bars 6-18 then bars 13-19, chosen by tools/bars.py chroma so that both joins (18 -> 13
and the wrap 19 -> 6) land where the harmony matches. Joins are 0.3 s equal-power crossfades centred on the bar line,
and the wrap is crossfaded across the file's end and start, so the file loops sample-accurately with no click."""
import json, subprocess, sys, pathlib
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L

SR = 44100
SRC = L.AUDIO / 'music' / 'loop_source_v1.mp3'
DB0, BAR = 0.02, 3.0
SEGMENTS = [(6, 18), (13, 19)]   # inclusive bar ranges
H = 0.15                        # half crossfade, seconds
TARGET_LUFS, TP_CEIL = -20.0, -1.5

x = L.pcm(SRC, SR, mono=False).astype(np.float64)
segs = [(DB0 + a * BAR, DB0 + (b + 1) * BAR) for a, b in SEGMENTS]
n_total = int(round(sum(e - s for s, e in segs) * SR))
out = np.zeros((n_total, 2))
h = int(H * SR)
t = np.linspace(0, 1, 2 * h, endpoint=False)[:, None]
fo, fi = np.cos(t * np.pi / 2), np.sin(t * np.pi / 2)
pos = 0
starts = []
for s, e in segs:
    a, b = int(round(s * SR)), int(round(e * SR))
    out[pos:pos + (b - a)] = x[a:b]
    starts.append((pos, a, b)); pos += b - a
# crossfade every boundary, including the wrap (last -> first)
for k in range(len(starts)):
    p_next = starts[(k + 1) % len(starts)][0] if k + 1 < len(starts) else n_total
    _, a_out, b_out = starts[k]
    _, a_in, _ = starts[(k + 1) % len(starts)]
    blk = x[b_out - h:b_out + h] * fo + x[a_in - h:a_in + h] * fi
    idx = (np.arange(p_next - h, p_next + h)) % n_total
    out[idx] = blk

tmp = L.AUDIO / 'music' / '_loop_tmp.wav'
def write(arr, path, codec='pcm_s16le'):
    raw = arr.astype(np.float32).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', codec, str(path)], input=raw, check=True)
write(out, tmp, 'pcm_f32le')
i0, tp0, _ = L.loudness(tmp)
g = 10 ** ((TARGET_LUFS - i0) / 20)
out *= g
peak_db = 20 * np.log10(np.max(np.abs(out)) + 1e-12)
if peak_db > TP_CEIL - 0.5:
    out *= 10 ** ((TP_CEIL - 0.5 - peak_db) / 20)
wav = L.AUDIO / 'music' / 'selection_loop_60s.wav'
mp3 = L.AUDIO / 'music' / 'selection_loop_60s.mp3'
write(out, wav)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '256k', str(mp3)], check=True)
tmp.unlink()
i1, tp1, lra = L.loudness(wav)
# seam check: sample-to-sample jump across the wrap vs the median jump in the file
d = np.abs(np.diff(np.vstack([out, out[:1]]), axis=0)).max(axis=1)
seam = float(d[-1]); med = float(np.median(d)); p999 = float(np.percentile(d, 99.9))
info = {'file': wav.name, 'mp3': mp3.name, 'length_s': n_total / SR, 'sample_rate': SR, 'bars': '6-18 then 13-19 of loop_source_v1 (80 BPM, 3.000 s bars)',
        'segments_source_s': [[round(s, 3), round(e, 3)] for s, e in segs], 'crossfade_s': 2 * H, 'loudness_lufs': i1, 'true_peak_dbtp': tp1, 'lra_lu': lra,
        'seam_jump': round(seam, 5), 'median_jump': round(med, 5), 'p99_9_jump': round(p999, 5),
        'note': 'Loop the WAV sample-accurately (Web Audio AudioBufferSourceNode.loop = true). The MP3 is for convenience: MP3 encoding adds padding, so an <audio loop> of it can leave a short gap.'}
(L.AUDIO / 'music' / 'selection_loop_60s.json').write_text(json.dumps(info, indent=1))
print(json.dumps(info, indent=1))
