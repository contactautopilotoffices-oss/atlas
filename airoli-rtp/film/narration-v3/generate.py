"""Generate full connected takes through the project's existing ElevenLabs helper."""
import concurrent.futures
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'film-src/audio/tools'))
import voice

spec = json.loads((HERE / 'script.json').read_text())

def generate(kind):
    dest = HERE / f'{kind}-{spec["take"]}.mp3'
    if dest.exists():
        raise RuntimeError(f'Refusing to overwrite existing take: {dest.name}')
    text = '\n\n'.join(b['text'] for b in spec[kind])
    result = voice.tts(spec['voice']['id'], text, dest, settings=spec['voice']['settings'])
    result.update({'text': text, 'voice': spec['voice'], 'kind': kind})
    (HERE / f'{kind}-{spec["take"]}.json').write_text(json.dumps(result, indent=2))
    print(kind, 'generated', result['duration_s'], 'seconds', flush=True)

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(generate, ['film', 'experience']))
