"""Fit connected takes to approved picture, retain pitch, and rebuild the soundtrack."""
import json
import pathlib
import re
import shutil
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SPEC = json.loads((HERE / 'script.json').read_text())

def ff(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)

def measure(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
    return json.loads(r[r.rfind('{'):r.rfind('}') + 1])

def stamp(t):
    ms = round(t * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

def build_voice(kind, length):
    take = json.loads((HERE / f'{kind}-{SPEC["take"]}.json').read_text())
    blocks = [dict(b) for b in SPEC[kind]]
    # The floor image opens before the spoken process example, so its name meets the actual selection.
    if kind == 'film':
        next(b for b in blocks if b['id'] == 'floor')['start'] = 95.5
    words = take['words']
    assert len(words) == len(take['text'].split())
    n, segments, captions = 0, [], []
    for b in blocks:
        count = len(b['text'].split())
        while n+count <= len(words) and ' '.join(w['word'] for w in words[n:n+count]) != b['text']:
            n += 1
        group = words[n:n+count]
        assert ' '.join(w['word'] for w in group) == b['text']
        a = 0 if n == 0 else (words[n-1]['end'] + group[0]['start']) / 2
        z = take['duration_s'] if n+count == len(words) else (group[-1]['end'] + words[n+count]['start']) / 2
        n += count
        tempo = max(.90, min(1.14, (z-a) / (b['end']-b['start']-.12)))
        duration = (z-a) / tempo
        assert b['start'] + duration <= b['end'] + .02, b['id']
        dest = HERE / f'{kind}-{b["id"]}.wav'
        ff(['-i', str(HERE/f'{kind}-{SPEC["take"]}.mp3'), '-af', f'atrim=start={a}:end={z},asetpts=PTS-STARTPTS,atempo={tempo},afade=t=in:d=0.012,afade=t=out:st={duration-.012}:d=0.012', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', str(dest)])
        b.update(file=dest.name, source_start=a, source_end=z, tempo=tempo, duration_s=duration)
        segments.append(b)
        chunk = []
        for i, w in enumerate(group):
            chunk.append(w)
            text = ' '.join(x['word'] for x in chunk)
            if len(text) >= 60 or (re.search(r'[.!?]$', w['word']) and len(text) >= 20) or i == len(group)-1:
                captions.append((b['start']+(chunk[0]['start']-a)/tempo, min(b['end'], b['start']+(chunk[-1]['end']-a)/tempo+.12), text))
                chunk = []
    inputs, filters, labels = [], [], []
    for i, b in enumerate(segments):
        inputs += ['-i', str(HERE/b['file'])]
        delay = round(b['start']*1000)
        filters.append(f'[{i}:a]adelay={delay}|{delay}[v{i}]'); labels.append(f'[v{i}]')
    filters.append(f'{"".join(labels)}amix=inputs={len(labels)}:normalize=0,apad=whole_dur={length},atrim=0:{length}[voice]')
    raw = HERE / f'{kind}-voice-raw.wav'
    ff([*inputs, '-filter_complex', ';'.join(filters), '-map', '[voice]', '-c:a', 'pcm_s24le', str(raw)])
    gain = -18-float(measure(raw)['input_i'])
    final = HERE / f'{kind}-voice.wav'
    ff(['-i', str(raw), '-af', f'volume={gain}dB', '-c:a', 'pcm_s24le', str(final)])
    ff(['-i', str(final), '-c:a', 'libmp3lame', '-b:a', '192k', str(HERE/f'{kind}-voice.mp3')])
    srt = '\n'.join(f'{i}\n{stamp(a)} --> {stamp(b)}\n{text}\n' for i, (a,b,text) in enumerate(captions, 1))
    (HERE/f'{kind}-captions.srt').write_text(srt)
    (HERE/f'{kind}-timeline.json').write_text(json.dumps({'length_s': length, 'voice': SPEC['voice'], 'segments': segments, 'source_take': f'{kind}-{SPEC["take"]}.mp3'}, indent=2))
    print(kind, 'voice assembled', [(b['id'], round(b['tempo'],3), round(b['start']+b['duration_s'],2)) for b in segments], flush=True)
    return final

def film_mix(voice):
    source = ROOT/'film-src/audio'
    cue = json.loads((source/'mix/timeline_B.json').read_text())
    inputs = ['-i', str(voice), '-i', str(source/cue['music']['file'])]
    music_gain = -25-float(measure(source/cue['music']['file'])['input_i'])
    filters = [f'[1:a]aresample=48000,aformat=channel_layouts=stereo,volume={music_gain}dB,apad=whole_dur=167,atrim=0:167,afade=t=out:st=164.5:d=2.5[music]', '[0:a]asplit=2[vo][key]', '[music][key]sidechaincompress=threshold=0.025:ratio=4:attack=30:release=700:makeup=1[bed]']
    labels = ['[vo]', '[bed]']
    for i, s in enumerate(cue['sfx'], 2):
        path = source/s['file']; inputs += ['-i', str(path)]
        gain = s['level_lufs']-float(measure(path)['input_i'])
        duration = s['play_s']; delay = round(s['at']*1000)
        filt = f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{duration},volume={gain}dB'
        if s['fade_in']: filt += f',afade=t=in:d={s["fade_in"]}'
        if s['fade_out']: filt += f',afade=t=out:st={max(0,duration-s["fade_out"])}:d={s["fade_out"]}'
        filters.append(f'{filt},adelay={delay}|{delay}[s{i}]'); labels.append(f'[s{i}]')
    filters.append(f'{"".join(labels)}amix=inputs={len(labels)}:normalize=0,apad=whole_dur=167,atrim=0:167[pre]')
    pre = HERE/'film-mix-pre.wav'
    ff([*inputs, '-filter_complex', ';'.join(filters), '-map', '[pre]', '-c:a', 'pcm_s24le', str(pre)])
    gain = -16-float(measure(pre)['input_i'])
    final = ROOT/'film/assets/film_audio_v2.wav'
    ff(['-i', str(pre), '-af', f'volume={gain}dB,aresample=192000,alimiter=limit=0.794:attack=3:release=60:level=disabled:latency=1,aresample=48000', '-c:a', 'pcm_s24le', str(final)])
    ff(['-i', str(final), '-c:a', 'libmp3lame', '-b:a', '256k', str(HERE/'film-mix.mp3')])
    (HERE/'mix-measurements.json').write_text(json.dumps(measure(final), indent=2))
    return final

if __name__ == '__main__':
    film = build_voice('film', 167)
    build_voice('experience', 91)
    film_mix(film)
    ff(['-ss', '2', '-i', str(HERE/'film-voice.wav'), '-t', '32', '-c:a', 'libmp3lame', '-b:a', '192k', str(HERE/'voice-preview.mp3')])
    print('Mix ready', flush=True)
