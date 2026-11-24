"""Provisional mix of the Andheri film: Alka's narration on the script's time slots, the music bed ducked 8 dB under
her voice, sound effects on the picture's beats (or on her words for the counter rolls), mastered to -16 LUFS
integrated and -1.5 dBTP.

  python3 -I mix.py

To re-time: change SLOT_LEAD / GAP_* or pin a line with AT_OVERRIDE (film seconds, speech start), and move SFX in
PICTURE_SFX / WORD_SFX; then re-run (about half a minute). Writes audio/mix_provisional.wav (+ .mp3),
audio/stems/{vo,music,sfx}.wav (each at its mix level, master gain applied, before the peak limiter, so the three
stems sum to the mix apart from limiting), audio/cues.json, and the film placement back into narration-v4/vo.json."""
import json, re, subprocess, sys, pathlib
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L

SR = 48000
A = L.AUDIO
MUSIC_FILE = A / 'music' / 'bed_v2.mp3'
LENGTH = 140.0
VO_LUFS, MUSIC_LUFS = -18.0, -23.0           # each VO line, and the un-ducked bed
DUCK_DB, DUCK_ATTACK, DUCK_RELEASE, DUCK_MERGE = -8.0, 0.25, 0.8, 0.9
DUCK_SFX_DB = -5.0                             # ambiences, risers and the impact tail also dip under her voice
NO_DUCK = {'sfx_ui_tick', 'sfx_ui_tick_crisp', 'sfx_counter_roll'}  # word-synced punctuation stays as placed
TARGET_LUFS, TP_CEIL = -16.0, -1.5
FIRST_SPEECH = 1.6                             # under black, after the type starts to fade up
SLOT_LEAD, GAP_SAME, GAP_NEW_SECTION = 0.3, 0.6, 1.0
AT_OVERRIDE = {}                               # e.g. {'l14_close_autopilot': 116.0}

# picture-tied effects: (sfx, at, level_lufs, fade_in, fade_out, play_s, what)
PICTURE_SFX = [
 ('sfx_wind_clouds', 5.5, -30, 2.5, 3.0, 12.0, 'wind through cloud, bridging out of black into the descent (0:08-0:20)'),
 ('sfx_cloud_whoosh', 7.6, -27, 0.0, 0.8, 4.0, 'cut from black into cloud at 0:08 (peak about 0.6 s in)'),
 ('sfx_city_far', 12.0, -34, 4.0, 3.0, 16.0, 'Mumbai far below: the city, the airport, Andheri East'),
 ('sfx_ui_tick', 17.6, -30, 0.0, 0.05, 0.48, 'pin 1 lands'),
 ('sfx_ui_tick', 18.3, -30, 0.0, 0.05, 0.48, 'pin 2 lands'),
 ('sfx_ui_tick', 19.0, -30, 0.0, 0.05, 0.48, 'pin 3 lands'),
 ('sfx_metro_viaduct', 19.5, -32, 0.5, 1.5, 10.0, 'Line 1 train on the Marol Naka viaduct (pass peaks about 22-25.5 s)'),
 ('sfx_riser', 23.5, -30, 0.3, 0.3, 4.0, 'riser into Privilon (crests at 0:27)'),
 ('sfx_city_far', 27.0, -36, 1.5, 2.0, 10.0, 'Privilon sunrise, the city waking'),
 ('sfx_evening_traffic', 37.0, -35, 1.0, 1.5, 7.5, 'Privilon at dusk'),
 ('sfx_metro_viaduct', 37.8, -34, 0.5, 1.5, 7.0, 'distant train on the viaduct alongside Privilon at dusk'),
 ('sfx_ui_tick_crisp', 44.2, -30, 0.0, 0.015, 0.045, 'CAD: Privilon plate draws in'),
 ('sfx_riser', 52.5, -30, 0.3, 0.3, 4.0, 'riser into Corporate Avenue (crests at 0:56)'),
 ('sfx_evening_traffic', 56.0, -35, 1.0, 1.5, 8.0, 'drone along Guru Hargovindji Road and through the gates'),
 ('sfx_ui_tick_crisp', 64.2, -30, 0.0, 0.015, 0.045, 'CAD: Corporate Avenue 3rd floor'),
 ('sfx_ui_tick_crisp', 76.2, -30, 0.0, 0.015, 0.045, 'map: the walk to Chakala metro'),
 ('sfx_riser', 77.5, -30, 0.3, 0.3, 4.0, 'riser into 723 Avenue (crests at 1:21)'),
 ('sfx_wind_clouds', 85.0, -37, 2.0, 2.0, 6.0, 'high air over the 723 terrace'),
 ('sfx_ui_tick_crisp', 90.2, -30, 0.0, 0.015, 0.045, 'CAD: 723 Avenue 13th floor'),
 ('sfx_ui_tick_crisp', 100.2, -30, 0.0, 0.015, 0.045, 'map: the walk to Marol Naka'),
 ('sfx_evening_traffic', 104.0, -34, 2.0, 2.5, 12.0, 'dusk pull-back over all three pins'),
 ('sfx_metro_viaduct', 106.5, -36, 1.0, 2.0, 8.0, 'a distant evening train in the pull-back'),
 ('sfx_logo_impact', 116.0, -25, 0.0, 1.0, 5.0, 'Autopilot x Flipkart lockup (impact, shimmer about 1.5 s in)'),
]
# effects locked to her words: (sfx, line id, phrase, offset_s from the phrase's first word, level, fade_in, fade_out, play_s, what)
WORD_SFX = [
 ('sfx_counter_roll', 'l06_privilon_plans', 'two sixty', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 260 seats'),
 ('sfx_counter_roll', 'l06_privilon_plans', 'two eighty', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 280 seats'),
 ('sfx_counter_roll', 'l06_privilon_plans', 'three hundred and one', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 301 seats'),
 ('sfx_ui_tick_crisp', 'l08_corporate_floors', 'fourth', -0.05, -30, 0.0, 0.015, 0.045, 'CAD: the 4th floor stacks on'),
 ('sfx_counter_roll', 'l08_corporate_floors', 'six thousand two hundred', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 6,207 sq ft (said 6,200)'),
 ('sfx_counter_roll', 'l08_corporate_floors', 'twelve thousand four hundred', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 12,414 sq ft (said 12,400)'),
 ('sfx_counter_roll', 'l09_corporate_metro', 'eight hundred and fifty', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 850 m'),
 ('sfx_ui_tick_crisp', 'l11_a723_terrace', 'open-air breakout', -0.05, -30, 0.0, 0.015, 0.045, 'CAD: terrace zone "Flipkart breakout" marked'),
 ('sfx_counter_roll', 'l12_a723_metro', 'seven hundred', -0.25, -35, 0.0, 0.2, 1.48, 'counter: 700 m'),
 ('sfx_counter_roll', 'l14_close_autopilot', 'fifteen thousand', -0.25, -37, 0.0, 0.2, 0.9, 'counter: 15,000+ seats'),
 ('sfx_counter_roll', 'l14_close_autopilot', 'twenty', -0.25, -37, 0.0, 0.2, 0.9, 'counter: 20+ centres'),
 ('sfx_counter_roll', 'l14_close_autopilot', 'seven', -0.25, -37, 0.0, 0.2, 0.9, 'counter: 7 cities'),
]
SECTIONS = [('Open', 0, 27), ('Privilon', 27, 56), ('Corporate Avenue', 56, 81), ('723 Avenue', 81, 104), ('Autopilot', 104, 130), ('Tail', 130, LENGTH)]

MUSIC_NOTE = 'bed_v2 is used. Both takes have no vocals and follow the section plan. bed_v1 opens with a pad swelling out of silence and its low piano note only at 0:05, runs at about 76 BPM, and stays flat from Corporate Avenue to 723 Avenue. bed_v2 opens on one low D piano note at 0:00 under black (then single low notes a bar apart, G at 0:03 and A at 0:06). It is a measured 80 BPM (3.000 s bars), and it lifts at every section: section RMS -22.0 / -18.6 / -15.4 / -14.6 / -13.1 / -12.6 dBFS from the open to Autopilot. It resolves at about 2:06 and decays to silence by about 2:16.'
HOW_TO_RETIME = "Edit tools/mix.py: pin a line's speech start with AT_OVERRIDE {'line id': film seconds}, or change FIRST_SPEECH / SLOT_LEAD / GAP_SAME / GAP_NEW_SECTION; move picture effects in PICTURE_SFX (word-synced counter rolls and ticks follow her words automatically); then run python3 -I tools/mix.py from andheri-project/film/audio (about a minute). It rewrites the mix, the three stems, this file and the placement in narration-v4/vo.json. To mix by hand instead: every VO line is narration-v4/<id>.mp3 at 'at' with 'gain_db'; the bed is music/bed_v2.mp3 at 0 with music.gain_db, dipped by ducking.depth_db over ducking.regions; each effect is its file at 'at' for play_s with its fades and gain_db (ambiences also dip sfx_depth_db under the voice)."
N = int(LENGTH * SR)
SCR = pathlib.Path('/private/tmp/claude-501/-Users-lohit-Downloads-Atlas/cc0f7fd1-64e8-4ee3-bd33-a14ee7e17bad/scratchpad')
SCR.mkdir(parents=True, exist_ok=True)


def load(path):
    return L.pcm(path, SR, mono=False).astype(np.float64)


def write(arr, path, codec='pcm_s24le'):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', codec, str(path)],
                   input=arr.astype(np.float32).tobytes(), check=True)


def lufs_arr(arr):
    p = SCR / '_m.wav'; write(arr, p, 'pcm_f32le'); i, tp, lra = L.loudness(p); p.unlink(); return i


def ebur(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = r[r.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[0-9.]+) LUFS', s).group(1)); tp = float(re.search(r'Peak:\s+(-?[0-9.]+) dBFS', s).group(1))
    lra = float(re.search(r'LRA:\s+(-?[0-9.]+) LU', s).group(1))
    return i, tp, lra


def place(buf, clip, at):
    a = int(round(at * SR)); b = min(N, a + len(clip))
    if b > a: buf[a:b] += clip[:b - a]


def fades(clip, fi, fo):
    n = len(clip); c = clip.copy()
    if fi > 0:
        k = min(n, int(fi * SR)); c[:k] *= np.linspace(0, 1, k)[:, None]
    if fo > 0:
        k = min(n, int(fo * SR)); c[n - k:] *= np.linspace(1, 0, k)[:, None]
    return c


def find_phrase(words, phrase):
    norm = lambda w: re.sub(r"[^a-z0-9']", '', w.lower().replace('-', ''))
    target = [norm(w) for w in phrase.replace('-', ' ').split()]
    seq = []
    for i, w in enumerate(words):
        for part in w['word'].replace('-', ' ').split():
            seq.append((i, norm(part)))
    for k in range(len(seq) - len(target) + 1):
        if [t for _, t in seq[k:k + len(target)]] == target:
            return words[seq[k][0]]
    raise KeyError(f'{phrase!r} not found')


def main():
    man_p = L.NARR / 'vo.json'; man = json.loads(man_p.read_text())
    lines = man['lines']
    vo = np.zeros((N, 2)); mus = np.zeros((N, 2)); sfx_free = np.zeros((N, 2)); sfx_duck = np.zeros((N, 2))
    cue_vo, speech_regions = [], []
    prev_end, prev_sec = None, None
    for ln in lines:
        if ln['id'] in AT_OVERRIDE:
            sp = AT_OVERRIDE[ln['id']]
        elif prev_end is None:
            sp = FIRST_SPEECH
        else:
            gap = GAP_SAME if ln['section'] == prev_sec else GAP_NEW_SECTION
            sp = max(ln['slot_s'][0] + SLOT_LEAD, prev_end + gap)
        at = round(sp - ln['speech_start_s'], 3)
        clip = load(L.NARR / ln['file']); g = VO_LUFS - ln['loudness_lufs']
        place(vo, clip * 10 ** (g / 20), at)
        s_from, s_to = round(at + ln['speech_start_s'], 3), round(at + ln['speech_end_s'], 3)
        for w in ln['words']:
            speech_regions.append([at + w['start'], at + w['end']])
        cue_vo.append({'id': ln['id'], 'section': ln['section'], 'file': f"../narration-v4/{ln['file']}", 'at': at, 'speech_from': s_from, 'speech_to': s_to,
                       'script_slot': ln['slot_s'], 'starts_late_by_s': round(max(0, s_from - ln['slot_s'][0]), 2),
                       'overruns_slot_by_s': round(max(0, s_to - ln['slot_s'][1]), 2), 'gain_db': round(g, 2), 'text': ln['text']})
        prev_end, prev_sec = s_to, ln['section']
    # speech activity -> duck envelope
    speech_regions.sort(); merged = []
    for s, e in speech_regions:
        if merged and s - merged[-1][1] < DUCK_MERGE: merged[-1][1] = max(merged[-1][1], e)
        else: merged.append([s, e])
    t = np.arange(N) / SR; env = np.zeros(N)
    for s, e in merged:
        a0, a1 = s - DUCK_ATTACK, e + DUCK_RELEASE
        i0, i1 = max(0, int(a0 * SR)), min(N, int(a1 * SR))
        seg = t[i0:i1]
        up = np.clip((seg - a0) / DUCK_ATTACK, 0, 1); down = np.clip((a1 - seg) / DUCK_RELEASE, 0, 1)
        env[i0:i1] = np.maximum(env[i0:i1], np.minimum(up, down))
    duck = 10 ** (DUCK_DB * env / 20)
    m = load(MUSIC_FILE)[:N]
    if len(m) < N: m = np.vstack([m, np.zeros((N - len(m), 2))])
    m_g = MUSIC_LUFS - L.loudness(MUSIC_FILE)[0]
    m = m * 10 ** (m_g / 20)
    m = fades(m, 0, 0)  # the bed decays to silence on its own
    mus = m * duck[:, None]
    # effects
    cue_sfx = []
    file_lufs = {}
    def add_sfx(name, at, lvl, fi, fo, pl, what, sync):
        p = A / 'sfx' / f'{name}.mp3'
        if name not in file_lufs: file_lufs[name] = L.loudness(p)[0]
        clip = load(p)[:int(pl * SR)]
        g = lvl - file_lufs[name]
        place(sfx_free if name in NO_DUCK else sfx_duck, fades(clip, fi, fo) * 10 ** (g / 20), at)
        cue_sfx.append({'id': f'{name}@{at:.2f}', 'file': f'sfx/{name}.mp3', 'at': round(at, 3), 'play_s': pl, 'fade_in': fi, 'fade_out': fo,
                        'level_lufs': lvl, 'gain_db': round(g, 2), 'ducked_under_voice_db': 0.0 if name in NO_DUCK else DUCK_SFX_DB, 'what': what, 'sync': sync})
    for name, at, lvl, fi, fo, pl, what in PICTURE_SFX:
        add_sfx(name, at, lvl, fi, fo, pl, what, 'picture (script time)')
    by_id = {c['id']: c for c in cue_vo}; words = {ln['id']: ln['words'] for ln in lines}
    for name, lid, phrase, off, lvl, fi, fo, pl, what in WORD_SFX:
        w = find_phrase(words[lid], phrase)
        add_sfx(name, by_id[lid]['at'] + w['start'] + off, lvl, fi, fo, pl, what, f'voice: "{phrase}" in {lid}')
    cue_sfx.sort(key=lambda c: c['at'])
    sfx = sfx_free + sfx_duck * (10 ** (DUCK_SFX_DB * env / 20))[:, None]
    # master: static gain to the target, then a 4x-oversampled peak limiter
    pre = vo + mus + sfx
    gain = TARGET_LUFS - lufs_arr(pre)
    for it in range(3):
        g = 10 ** (gain / 20)
        pre_p = SCR / '_pre.wav'; write(pre * g, pre_p, 'pcm_f32le')
        out = A / 'mix_provisional.wav'
        lim = 10 ** ((TP_CEIL - 0.3) / 20)
        chain = f'aresample=192000,alimiter=limit={lim:.4f}:attack=2:release=80:level=disabled:latency=1,aresample={SR}'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(pre_p), '-af', chain, '-c:a', 'pcm_s24le', str(out)], check=True)
        i, tp, lra = ebur(out)
        print(f'pass {it + 1}: gain {gain:+.2f} dB -> {i} LUFS, {tp} dBTP, LRA {lra}')
        if abs(i - TARGET_LUFS) <= 0.1 and tp <= TP_CEIL: break
        gain += TARGET_LUFS - i
    pre_p.unlink()
    g = 10 ** (gain / 20)
    (A / 'stems').mkdir(exist_ok=True)
    for name, arr in (('vo', vo), ('music', mus), ('sfx', sfx)):
        write(arr * g, A / 'stems' / f'{name}.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(out), '-c:a', 'libmp3lame', '-b:a', '256k', str(A / 'mix_provisional.mp3')], check=True)
    # how far the voice sits above the music (and music + effects) in 0.4 s windows where she is actually speaking
    hop = int(0.4 * SR); n = N // hop
    db = lambda arr: 20 * np.log10(np.sqrt(np.mean(arr[:n * hop].reshape(n, hop, 2) ** 2, axis=(1, 2))) + 1e-9)
    Vd, Md, Rd = db(vo), db(mus), db(mus + sfx)
    act = Vd > np.median(Vd[Vd > -60]) - 8
    ratios, ratios_all = Vd[act] - Md[act], Vd[act] - Rd[act]
    stems_lufs = {n: round(lufs_arr(a * g), 2) for n, a in (('vo', vo), ('music', mus), ('sfx', sfx))}
    cues = {
        'film': 'Flipkart x Autopilot: Andheri East, the shortlist (script draft 4)', 'status': 'provisional: the integrator re-times to the final picture',
        'how_to_retime': HOW_TO_RETIME,
        'length_s': LENGTH, 'sample_rate': SR, 'bit_depth': 24,
        'master': {'file': 'mix_provisional.wav', 'target_lufs': TARGET_LUFS, 'true_peak_ceiling_dbtp': TP_CEIL, 'measured_lufs': i, 'measured_true_peak_dbtp': tp,
                   'lra_lu': lra, 'master_gain_db': round(gain, 2), 'limiter': '4x oversampled alimiter, ceiling -1.8 dBFS'},
        'stems': {'files': ['stems/vo.wav', 'stems/music.wav', 'stems/sfx.wav'], 'note': 'each at its mix level with the master gain applied, before the limiter; vo + music + sfx = the mix apart from limiting', 'lufs': stems_lufs},
        'sections': [{'name': n, 'from': a, 'to': b} for n, a, b in SECTIONS],
        'music': {'file': 'music/bed_v2.mp3', 'at': 0.0, 'base_level_lufs': MUSIC_LUFS, 'gain_db': round(m_g, 2), 'choice': MUSIC_NOTE,
                  'ducking': {'depth_db': DUCK_DB, 'attack_s': DUCK_ATTACK, 'release_s': DUCK_RELEASE, 'merge_gaps_under_s': DUCK_MERGE,
                              'sfx_depth_db': DUCK_SFX_DB, 'sfx_not_ducked': sorted(NO_DUCK), 'regions': [[round(s, 2), round(e, 2)] for s, e in merged]},
                  'voice_over_music_db_while_speaking': {'median': round(float(np.median(ratios)), 1), 'p10': round(float(np.percentile(ratios, 10)), 1)},
                  'voice_over_music_and_sfx_db_while_speaking': {'median': round(float(np.median(ratios_all)), 1), 'p10': round(float(np.percentile(ratios_all, 10)), 1), 'min': round(float(ratios_all.min()), 1)}},
        'vo_level_lufs': VO_LUFS, 'vo': cue_vo, 'sfx': cue_sfx,
        'vo_speech_total_s': round(sum(c['speech_to'] - c['speech_from'] for c in cue_vo), 2),
    }
    (A / 'cues.json').write_text(json.dumps(cues, indent=1, ensure_ascii=False))
    for ln in lines:
        c = by_id[ln['id']]; ln['provisional_at'] = c['at']; ln['provisional_speech'] = [c['speech_from'], c['speech_to']]
    man_p.write_text(json.dumps(man, indent=1, ensure_ascii=False))
    print('stems', stems_lufs, '| voice over music:', cues['music']['voice_over_music_db_while_speaking'], '| over music+sfx:', cues['music']['voice_over_music_and_sfx_db_while_speaking'])
    worst = np.argsort(np.where(act, Vd - Rd, 99))[:4]
    print('  lowest voice-over-rest windows:', [(round(k * 0.4, 1), round(float(Vd[k] - Rd[k]), 1)) for k in worst])
    for c in cue_vo:
        print(f"  {c['id']:22s} speech {c['speech_from']:7.2f}-{c['speech_to']:7.2f}  slot {c['script_slot']}  late {c['starts_late_by_s']}  over {c['overruns_slot_by_s']}")


main()
