"""Sound effects for the Andheri film, ElevenLabs sound generation (eleven_text_to_sound_v2).
  python3 -I gen_sfx.py [names...]   # all by default; existing files are kept unless named"""
import json, sys, time, pathlib, urllib.request, urllib.error
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L
el = L.el
OUT = L.AUDIO / 'sfx'; OUT.mkdir(exist_ok=True)
# name, prompt, seconds, loop, prompt_influence
SFX = [
 ('sfx_wind_clouds', 'High-altitude wind streaming through thick clouds, airy and smooth, soft rushing air with slow gentle swells, calm, no howling, no gusts, no whistling', 12.0, True, 0.45),
 ('sfx_cloud_whoosh', 'A soft airy whoosh as a camera glides down through a cloud and breaks out into clear air, smooth filtered rush that swells and fades, gentle, no impact, no hit', 4.0, False, 0.5),
 ('sfx_city_far', 'Distant Mumbai city ambience heard from high above: a faint far wash of traffic, very distant soft car horns, a few far birds, calm and low, no close sounds', 16.0, True, 0.4),
 ('sfx_metro_viaduct', 'A modern metro train passing on an elevated concrete viaduct, heard from street level a short distance away: smooth electric motor whine rising and falling, soft steady rail rhythm, gentle doppler pass from left to right, no horn, no announcements', 10.0, False, 0.5),
 ('sfx_ui_tick', 'A single soft subtle user-interface tick, clean, very short, quiet, premium software tap, no reverb', 0.5, False, 0.6),
 ('sfx_ui_tick_crisp', 'A single crisp delicate user-interface tick, high and glassy, very short and quiet, like a premium watch click, clean, no reverb', 0.5, False, 0.6),
 ('sfx_counter_roll', 'A soft digital counter roll: a quick run of tiny quiet ticks like an odometer rolling up and settling on a number, clean and premium, ends with one soft final tick', 1.5, False, 0.55),
 ('sfx_riser', 'A gentle cinematic riser: a soft airy swell with a faint shimmer that rises smoothly for four seconds into a transition, warm and subtle, no hit at the end, no impact', 4.0, False, 0.5),
 ('sfx_logo_impact', 'A soft cinematic impact for a logo reveal: a warm low deep thud with a gentle bloom, followed by a delicate bright shimmer that sparkles and fades away, elegant and premium, not aggressive', 5.0, False, 0.5),
 ('sfx_evening_traffic', 'Evening traffic ambience in Mumbai heard from a little distance: a steady soft flow of cars and auto-rickshaws, occasional distant horns, warm and calm, no close voices', 16.0, True, 0.4),
]

names = sys.argv[1:]
req_p = OUT / 'sfx_requests.json'
log = {x['file']: x for x in json.loads(req_p.read_text())} if req_p.exists() else {}
c0 = L.counter()
for name, text, dur, loop, infl in SFX:
    if names and name not in names: continue
    if not names and (OUT / f'{name}.mp3').exists(): print('kept', name); continue
    body = {'text': text, 'duration_seconds': dur, 'prompt_influence': infl, 'model_id': 'eleven_text_to_sound_v2'}
    if loop: body['loop'] = True
    req = urllib.request.Request(f'{el.BASE}/v1/sound-generation?output_format=mp3_44100_192', data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': el.KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            audio = r.read()
        (OUT / f'{name}.mp3').write_bytes(audio)
        log[f'{name}.mp3'] = {'file': f'{name}.mp3', **body}
        L.ledger('sfx', name, 0, seconds=dur)
        print('ok', name, len(audio), 'bytes')
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, name, e.read().decode('utf-8', 'replace')[:400])
req_p.write_text(json.dumps(list(log.values()), indent=1))
time.sleep(3)
print('counter', c0, '->', L.counter())
