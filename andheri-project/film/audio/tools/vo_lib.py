"""Shared helpers for the Andheri film audio. Builds on the Reliable Tech Park tools (el.py reads the ElevenLabs key
from the founder's .env at run time and never prints it; nothing here prints or logs it either)."""
import json, pathlib, re, subprocess, sys, time
import numpy as np

ATLAS = pathlib.Path('/Users/lohit/Downloads/Atlas')
RTP_TOOLS = ATLAS / 'airoli-rtp/film-src/audio/tools'
sys.path.insert(0, str(RTP_TOOLS))
import el, voice  # noqa: E402

FILM = ATLAS / 'andheri-project/film'
NARR = FILM / 'narration-v4'
AUDIO = FILM / 'audio'
LEDGER = AUDIO / 'tools' / 'ledger.jsonl'
VOICE_ID, VOICE_NAME = 'Z1oY2Vw237R6ALt5CZcD', 'Alka S - Natural, Warm, Ecom-Ready'


def ledger(kind, ident, chars=0, **extra):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open('a') as f:
        f.write(json.dumps({'t': time.strftime('%Y-%m-%d %H:%M:%S'), 'kind': kind, 'id': ident, 'chars': chars, **extra}) + '\n')


def counter():
    return el.usage()['character_count']


def pcm(path, sr=16000, mono=True):
    """Decode any audio file to float32 numpy (mono -> 1-D, stereo -> (n, 2))."""
    ch = 1 if mono else 2
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', str(ch), '-ar', str(sr), '-'],
                       capture_output=True, check=True)
    a = np.frombuffer(r.stdout, dtype=np.float32)
    return a if mono else a.reshape(-1, 2)


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    j = json.loads(r[r.rfind('{'):r.rfind('}') + 1])
    return float(j['input_i']), float(j['input_tp']), float(j['input_lra'])


def silences(path, db=-40, d=0.12):
    sd = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', f'silencedetect=n={db}dB:d={d}', '-f', 'null', '-'],
                        capture_output=True, text=True).stderr
    return [float(x) for x in re.findall(r'silence_(?:start|end): ([0-9.]+)', sd)]


def speech_bounds(path, dur):
    marks = silences(path)
    pairs = [(marks[j], marks[j + 1] if j + 1 < len(marks) else dur) for j in range(0, len(marks), 2)]
    lead = next((e for s0, e in pairs if s0 < 0.02), 0.0)
    tail = next((dur - s0 for s0, e in pairs if e >= dur - 0.05 and s0 > 0.02), 0.0)
    pauses = [round(e - s0, 2) for s0, e in pairs if s0 >= 0.02 and e < dur - 0.05]
    return round(lead, 3), round(dur - tail, 3), pauses


def pitch_stats(path):
    """Rough F0 track (normalised autocorrelation, 10 ms hop) -> median Hz and spread in semitones.
    A livelier read has a wider spread. Used only to compare takes of the same voice."""
    sr = 16000
    x = pcm(path, sr)
    win, hop = 640, 160
    lo, hi = sr // 420, sr // 120
    f0 = []
    rms_all = np.sqrt(np.mean(x ** 2)) + 1e-9
    for i in range(0, len(x) - win, hop):
        fr = x[i:i + win] - np.mean(x[i:i + win])
        if np.sqrt(np.mean(fr ** 2)) < 0.35 * rms_all:
            continue
        ac = np.correlate(fr, fr, 'full')[win - 1:]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.55:
            f0.append(sr / k)
    if len(f0) < 10:
        return {'f0_median_hz': None, 'f0_spread_st': None}
    f0 = np.array(f0)
    st = 12 * np.log2(f0 / np.median(f0))
    st = st[np.abs(st) < 12]  # drop octave errors
    return {'f0_median_hz': round(float(np.median(f0)), 1), 'f0_spread_st': round(float(np.percentile(st, 90) - np.percentile(st, 10)), 2)}


NUM_ALIASES = [(r'(\d),(\d{3})', r'\1\2')]


def stt_check(path, terms, language='en'):
    s = voice.stt(path, language_code=language)
    txt = s['text']
    t2 = txt
    for a, b in NUM_ALIASES:
        t2 = re.sub(a, b, t2)
    ok1, d1 = voice.check(terms, txt)
    ok2, d2 = voice.check(terms, t2)
    detail = {k: d1[k] or d2[k] for k in d1}
    return all(detail.values()), detail, txt


def nwords(text):
    text = re.sub(r'<[^>]*>', ' ', text)
    return len(re.findall(r"[A-Za-z0-9'’\u0900-\u097F-]+", text))
