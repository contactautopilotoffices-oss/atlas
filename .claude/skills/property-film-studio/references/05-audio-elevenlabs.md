# 05: Audio with ElevenLabs. Voice, SFX, music and the mix.

The working code is in `andheri-project/film/audio/tools/`:
- `gen_vo.py` and `vo_lib.py`: the voice;
- `gen_sfx.py`: sound effects;
- `gen_music.py` and `make_loop.py`: music;
- `mix.py`: the mix.

They build on the HTTP helper in `airoli-rtp/film-src/audio/tools/el.py`
and `voice.py`.

## The key

- Read it from the environment: `ELEVENLABS_API_KEY`.
  - The old helper read it from a `.env` file outside the repo. Either way
    is fine, as long as it is never printed, logged or committed.
- Check credits before a batch with `GET /v1/user/subscription`
  (`character_count`). Log every call in `audio/tools/ledger.jsonl`.

## Voice (TTS)

- Endpoint: `POST /v1/text-to-speech/{voice_id}/with-timestamps`, with the
  model `eleven_multilingual_v2`. Word timings come back with the audio.
  Save them as `<id>.words.json`; they drive the captions and the SFX that
  land on words.
- Andheri used **Alka S, "Natural, Warm, Ecom-Ready"**
  (`Z1oY2Vw237R6ALt5CZcD`) with these settings:
  stability 0.45, similarity_boost 0.75, style 0.30, speed 0.95,
  speaker_boost on.
- **One file per script line.** Pass `previous_text` and `next_text` so
  the intonation flows across the cuts. One line can then be re-recorded
  alone (`gen_vo.py l03_marol --force`).
- **Audition first.** Record two setting sets on the first two lines and
  let the founder pick. The result goes in `narration-v4/settings.json`.
- **Check every take with speech-to-text.** Run `POST /v1/speech-to-text`
  with `scribe_v1` and word timestamps, then diff the transcript against the
  script. A take only passes when the words match, so mispronounced names
  or numbers fail.

### Prompting the voice, for first-timers

- Write the text the way it should be spoken, not the way it is spelled:
  - "twelve thousand four hundred and fourteen square feet", not "12,414
    sq ft";
  - "seven twenty-three Avenue";
  - "Marol Naka".
- Keep the canonical number in the caption and the spoken form in the
  `tts` field of `lines.json`.
- Punctuation is direction:
  - a comma is a short breath;
  - a full stop is a full pause;
  - "—" is a hesitation;
  - never use "…" (it gives a trailing, unsure read).
- Use short sentences, one idea each, and 8 to 14 words a line for a
  140 s film.
- Hindi or Hinglish lines ("Pehle vyavahar, phir vyapar.") work on the
  multilingual model. Audition them separately.
- If a word comes out wrong, re-spell it phonetically in `tts` ("Privilon"
  as "Privi-lawn") and re-check with speech-to-text.
- Stability: lower (0.35 to 0.45) is more expressive, higher (0.55 to
  0.65) is steadier. Style above 0.4 starts to sound acted.

## Sound effects

- Endpoint: `POST /v1/sound-generation`, with `model_id:
  eleven_text_to_sound_v2`, `duration_seconds`, `prompt_influence` (0.4 to
  0.6) and `loop: true` for ambiences.
- **The prompt formula:** what it is, where it is heard from, its
  character, and what to leave out.

  > "A modern metro train passing on an elevated concrete viaduct, heard
  > from street level a short distance away: smooth electric motor whine
  > rising and falling, soft steady rail rhythm, gentle doppler pass from
  > left to right, no horn, no announcements"

- The full Andheri set, ready to reuse, is in the `SFX` list of
  `gen_sfx.py`:
  - wind through clouds;
  - a whoosh out of the cloud;
  - the far city;
  - the metro on the viaduct;
  - UI ticks;
  - a counter roll;
  - a riser;
  - the logo impact;
  - evening traffic.
- Always add "no X" for the things the model likes to add: howling,
  horns, voices, impacts.

## Music

- Endpoint: `POST /v1/music`, with `model_id: music_v1` and a
  `composition_plan`.
  - The plan has global `positive_styles` and `negative_styles`, plus
    sections with their own styles and `duration_ms`.
  - Set `respect_sections_durations: true`, so each section lands on the
    script's time slots.
- **Global positive styles:** "premium cinematic underscore for a corporate
  real-estate film, soft felt piano, warm string ensemble, gentle pulse, 80
  BPM, D major, restrained dynamics that leave room for a voice-over".
- **Global negative styles:** "vocals, choir, drum kit, EDM, trailer hits,
  braams, cheesy corporate stock music, ukulele, whistling, bombastic
  brass".
- **One section per film beat**, each a subtle lift. End with "a confident
  resolve to the tonic, long natural decay into silence".
- Loops for web pages: `make_loop.py` crossfades a 70 s ambient take into a
  seamless 60 s loop.

## The mix (`mix.py`)

- **Levels:**
  - voice at −18 LUFS per line;
  - the music bed at −23 LUFS, ducked 8 dB under the voice (attack 0.25 s,
    release 0.8 s);
  - ambiences dip 5 dB under the voice;
  - UI ticks and counter rolls don't duck.
- **Master:** −16 LUFS integrated, −1.5 dBTP.
- **Timing:**
  - `SLOT_LEAD` and `GAP_*` space the lines;
  - `AT_OVERRIDE` pins a line to an exact film second;
  - `PICTURE_SFX` puts effects on the picture's beats;
  - `WORD_SFX` puts them on a spoken word.
- **Outputs:** `mix.wav`, the stems (vo, music, sfx), and `cues.json`,
  which the edit reads for the caption and card timing.
- **Licences:** record the plan and the source of every sound in
  `audio/LICENCE.md`.
