"""Alka's narration for the Andheri film, draft 4: one file per script line, word timings, speech-to-text check.

  python3 -I gen_vo.py audition            # two settings on the first two lines -> narration-v4/audition/
  python3 -I gen_vo.py [ids...] [--force]  # record lines with the chosen settings (narration-v4/settings.json)

Each take is kept in narration-v4/takes/; the current take of each line is narration-v4/<id>.mp3 + <id>.words.json,
and narration-v4/vo.json is the manifest. A line that already passes is skipped unless --force or named."""
import argparse, json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L

ap = argparse.ArgumentParser()
ap.add_argument('ids', nargs='*')
ap.add_argument('--force', action='store_true')
args = ap.parse_args()

spec = json.loads((L.NARR / 'lines.json').read_text())['lines']
by_id = {l['id']: i for i, l in enumerate(spec)}
BASE = {'similarity_boost': 0.75, 'use_speaker_boost': True}
AUDITION = {
    'A': dict(BASE, stability=0.45, style=0.30, speed=0.95),
    'B': dict(BASE, stability=0.45, style=0.30, speed=1.00),
}


def record(line, settings, out_mp3, label):
    i = by_id[line['id']]
    prev_t = spec[i - 1]['tts'] if i > 0 else None
    next_t = spec[i + 1]['tts'] if i + 1 < len(spec) else None
    r = L.voice.tts(L.VOICE_ID, line['tts'], out_mp3, settings=settings, previous_text=prev_t, next_text=next_t)
    L.ledger('tts', label, len(line['tts']), voice_id=L.VOICE_ID, settings=settings)
    ok, detail, heard = L.stt_check(out_mp3, line['terms'])
    L.ledger('stt', label, 0, seconds=r['duration_s'])
    dur = r['duration_s']
    s0, s1, pauses = L.speech_bounds(out_mp3, dur)
    lufs, tp, lra = L.loudness(out_mp3)
    nw = L.nwords(line['tts'])
    m = {'duration_s': dur, 'speech_start_s': s0, 'speech_end_s': s1, 'speech_s': round(s1 - s0, 3),
         'words_per_s': round(nw / max(0.1, s1 - s0), 2), 'internal_pauses_s': pauses,
         'loudness_lufs': lufs, 'true_peak_dbtp': tp, 'lra_lu': lra, **L.pitch_stats(out_mp3),
         'stt_text': heard, 'stt_pass': ok, 'stt_terms': detail, 'words': r['words']}
    slot = line['slot'][1] - line['slot'][0]
    flag = 'PASS' if ok else 'FAIL ' + str([k for k, v in detail.items() if not v])
    print(f"{label}: {dur:.2f}s file, speech {m['speech_s']:.2f}s in a {slot}s slot, {m['words_per_s']} w/s, "
          f"pauses {pauses}, F0 {m['f0_median_hz']} Hz spread {m['f0_spread_st']} st, {lufs} LUFS | heard: {heard} | {flag}")
    return m


if args.ids[:1] == ['audition']:
    outdir = L.NARR / 'audition'; outdir.mkdir(exist_ok=True)
    c0 = L.counter()
    res = {'settings': AUDITION, 'lines': {}}
    for key, st in AUDITION.items():
        for line in spec[:2]:
            mp3 = outdir / f"{key}_{line['id']}.mp3"
            m = record(line, st, mp3, f"audition_{key}_{line['id']}")
            m.pop('words')
            res['lines'][f"{key}_{line['id']}"] = {'file': f'audition/{mp3.name}', 'slot_s': line['slot'][1] - line['slot'][0], **m}
    res['counter_before'] = c0
    (outdir / 'audition.json').write_text(json.dumps(res, indent=1, ensure_ascii=False))
    print('counter', c0, '->', L.counter())
    sys.exit()

if args.ids[:1] == ['select']:
    # select <id> <take>: make an earlier take the current one again
    lid, n = args.ids[1], int(args.ids[2])
    man_p = L.NARR / 'vo.json'; man = json.loads(man_p.read_text())
    e = next(l for l in man['lines'] if l['id'] == lid)
    t = next(x for x in e['takes'] if x['take'] == n)
    (L.NARR / f'{lid}.mp3').write_bytes((L.NARR / t['file']).read_bytes())
    words = json.loads((L.NARR / 'takes' / f'{lid}_t{n}.words.json').read_text())
    (L.NARR / f'{lid}.words.json').write_text(json.dumps(words, indent=1, ensure_ascii=False))
    e.update({k: v for k, v in t.items() if k not in ('file', 'settings')}); e['tts_text'] = t.get('tts_text', e['tts_text']); e['words'] = words; e['take'] = n
    man_p.write_text(json.dumps(man, indent=1, ensure_ascii=False)); print(lid, 'now take', n); sys.exit()

cfg = json.loads((L.NARR / 'settings.json').read_text())
SET = cfg['settings']
man_p = L.NARR / 'vo.json'
man = json.loads(man_p.read_text()) if man_p.exists() else {}
prev = {b['id']: b for b in man.get('lines', [])}
c0 = L.counter()
for line in spec:
    if args.ids and line['id'] not in args.ids:
        continue
    if line['id'] in prev and prev[line['id']].get('stt_pass') and not args.force and not args.ids:
        print(line['id'], 'kept (passing)'); continue
    n = len(list((L.NARR / 'takes').glob(line['id'] + '_t*.mp3'))) + 1
    take = L.NARR / 'takes' / f"{line['id']}_t{n}.mp3"
    st = dict(SET, **line.get('settings_override', {}))
    m = record(line, st, take, f"{line['id']}_t{n}")
    (L.NARR / f"{line['id']}.mp3").write_bytes(take.read_bytes())
    (L.NARR / f"{line['id']}.words.json").write_text(json.dumps(m['words'], indent=1, ensure_ascii=False))
    (L.NARR / 'takes' / f"{line['id']}_t{n}.words.json").write_text(json.dumps(m['words'], indent=1, ensure_ascii=False))
    history = prev.get(line['id'], {}).get('takes', [])
    history.append({'take': n, 'file': f'takes/{take.name}', 'tts_text': line['tts'], 'settings': st,
                    **{k: v for k, v in m.items() if k != 'words'}})
    prev[line['id']] = {'id': line['id'], 'section': line['section'], 'slot_s': line['slot'], 'text': line['text'], 'tts_text': line['tts'],
                        'file': f"{line['id']}.mp3", 'words_file': f"{line['id']}.words.json", 'take': n, **m, 'takes': history}

man.update({'film': 'Flipkart x Autopilot: Andheri East, the shortlist (script draft 4)', 'voice': L.VOICE_NAME, 'voice_id': L.VOICE_ID,
            'model': L.voice.MODEL, 'output_format': L.voice.FMT, 'settings': SET, 'settings_reason': cfg.get('reason'),
            'continuity': 'each request carries previous_text and next_text (the neighbouring lines)',
            'timings': 'times in each line are seconds from the start of its own file; slot_s is the script time slot in film seconds'})
man['lines'] = [prev[l['id']] for l in spec if l['id'] in prev]
man_p.write_text(json.dumps(man, indent=1, ensure_ascii=False))
print('counter', c0, '->', L.counter())
