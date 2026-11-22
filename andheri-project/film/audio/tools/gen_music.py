"""Music for the Andheri film: the 2:20 bed (sections on the script's time slots) and a 70 s ambient take that
make_loop.py turns into the 60 s loop for the website's property-selection screen. ElevenLabs Music (music_v1).

  python3 -I gen_music.py bed|bed2|loop"""
import json, sys, time, pathlib, urllib.request, urllib.error
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import vo_lib as L
el = L.el
OUT = L.AUDIO / 'music'; OUT.mkdir(exist_ok=True)

G_POS = ['premium cinematic underscore for a corporate real-estate film', 'soft felt piano', 'warm string ensemble',
         'gentle steady pulse from softly repeated muted piano and a low warm synth pulse', '80 BPM', 'D major',
         'elegant, assured, modern, warm', 'instrumental', 'restrained dynamics that leave room for a voice-over']
G_NEG = ['vocals', 'choir', 'humming', 'drum kit', 'snare', 'hi-hats', 'claps', 'EDM', 'trap', 'dubstep', 'trailer hits', 'braams',
         'cheesy corporate stock music', 'ukulele', 'whistling', 'glockenspiel', 'electric guitar', 'lead synth', 'bombastic brass']

BED = [  # (name, ms, positive, negative) on the script's time slots
 ('Under black', 8000, ['a single low felt piano note, struck once, left to ring', 'near silence around it', 'the faintest warm air of a pad underneath'],
  ['melody', 'strings', 'pulse', 'chords']),
 ('Through the clouds to Marol Naka', 19000, ['airy high strings and a soft pad swell in slowly', 'the gentle pulse begins, very soft', 'a sense of descending and arriving', 'sparse'],
  ['loud', 'busy', 'drums']),
 ('Privilon', 29000, ['first subtle lift', 'felt piano motif over warm strings', 'gentle steady pulse', 'sunrise warmth', 'calm forward motion under the voice'],
  ['loud', 'dramatic', 'busy']),
 ('Corporate Avenue', 25000, ['a second subtle lift, slightly brighter', 'pulse a touch fuller', 'warm cello line joins the piano', 'purposeful, clear'],
  ['loud', 'dramatic', 'tension']),
 ('723 Avenue', 23000, ['a third lift, a sense of height and open air', 'strings open into a higher register', 'piano motif in a higher octave', 'still restrained'],
  ['loud', 'epic', 'tension']),
 ('Autopilot', 22000, ['piano and full warm strings swell with quiet confidence', 'pulse steady and full', 'heartfelt, assured, building to the resolve'],
  ['bombastic', 'epic trailer', 'percussion hits']),
 ('Resolve', 14000, ['a confident resolve to the tonic D major chord', 'one last low piano note', 'long natural decay into silence'],
  ['new theme', 'build', 'pulse']),
]
LOOP = [
 ('Ambient A', 35000, ['ambient, minimal and steady', 'scattered felt piano notes over a warm string pad', 'the same soft low pulse throughout', 'constant gentle dynamics', 'no intro, no ending, loopable'],
  ['crescendo', 'build', 'ending', 'fade out', 'drums']),
 ('Ambient B', 35000, ['ambient, minimal and steady', 'scattered felt piano notes over a warm string pad', 'the same soft low pulse throughout', 'constant gentle dynamics', 'continues seamlessly, no ending'],
  ['crescendo', 'build', 'ending', 'fade out', 'drums']),
]


BED_V2 = [('Under black', 8000, ['one single low felt piano note, a low D, struck once at the very start and left to ring alone with a long natural decay',
                                 'nothing else playing', 'intimate, still, dark'],
           ['pad', 'strings', 'chords', 'swell', 'melody', 'pulse', 'second note'])] + BED[1:]


def run(kind):
    secs = {'bed': BED, 'bed2': BED_V2, 'loop': LOOP}[kind]
    plan = {'positive_global_styles': G_POS if kind.startswith('bed') else G_POS[:4] + ['80 BPM', 'D major', 'calm, premium, ambient', 'instrumental'],
            'negative_global_styles': G_NEG,
            'sections': [{'section_name': n, 'positive_local_styles': p, 'negative_local_styles': q, 'duration_ms': d, 'lines': []} for n, d, p, q in secs]}
    body = {'composition_plan': plan, 'model_id': 'music_v1', 'respect_sections_durations': True}
    name = {'bed': 'bed_v1', 'bed2': 'bed_v2', 'loop': 'loop_source_v1'}[kind]
    (OUT / f'{name}_request.json').write_text(json.dumps(body, indent=1))
    c0 = L.counter()
    for fmt in ('mp3_44100_192', 'mp3_44100_128'):
        req = urllib.request.Request(f'{el.BASE}/v1/music?output_format={fmt}', data=json.dumps(body).encode(), method='POST',
                                     headers={'xi-api-key': el.KEY, 'Content-Type': 'application/json'})
        try:
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=900) as r:
                audio = r.read()
                hdr = {k: v for k, v in r.headers.items() if k.lower() in ('song-id', 'x-song-id', 'character-cost', 'x-character-count', 'request-id', 'history-item-id')}
            (OUT / f'{name}.mp3').write_bytes(audio)
            (OUT / f'{name}_response.json').write_text(json.dumps({'format': fmt, 'headers': hdr, 'seconds_to_generate': round(time.time() - t0)}, indent=1))
            print('ok', name, fmt, len(audio), 'bytes', hdr)
            break
        except urllib.error.HTTPError as e:
            print('HTTP', e.code, fmt, e.read().decode('utf-8', 'replace')[:600])
    time.sleep(5)
    c1 = L.counter()
    L.ledger('music', name, 0, ms=sum(s[1] for s in secs), counter_before=c0, counter_after=c1)
    print('counter', c0, '->', c1)


run(sys.argv[1])
