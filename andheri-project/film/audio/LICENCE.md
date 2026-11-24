# Licence notes: the Andheri film audio

Written 23 Nov 2026 for the Flipkart × Autopilot Andheri East film (script draft 4). Nothing here is published.

## Where every sound comes from

All of the audio was **generated with ElevenLabs** on the founder's ElevenLabs account (pay-as-you-go plan) on 23 Nov 2026. It is **AI-generated**. No third-party track, sample, loop or recording was used.

| What | Files | How it was made |
| --- | --- | --- |
| Narration | `../narration-v4/l01_open.mp3` … `l15_close_together.mp3`, plus every take in `../narration-v4/takes/` and the auditions in `../narration-v4/audition/` | ElevenLabs text-to-speech, model `eleven_multilingual_v2`, voice **Alka S - Natural, Warm, Ecom-Ready** (`Z1oY2Vw237R6ALt5CZcD`, an ElevenLabs Voice Library voice). It is a synthetic voice, not a recording of a person reading this script. |
| Film music bed | `music/bed_v2.mp3` (used), `music/bed_v1.mp3` (alternate take, not used) | ElevenLabs Music, model `music_v1`, a composition plan with seven timed sections. Song ids: v2 `WDGcHPCgzK2JuPqLCzl2`, v1 `2K15j7B8BgAoMVU5OBQf`. The requests are in `music/bed_v2_request.json` and `music/bed_v1_request.json`. |
| Website loop | `music/selection_loop_60s.wav` and `.mp3`, made from `music/loop_source_v1.mp3` | ElevenLabs Music, `music_v1`, song id `RbRzdWWNHHbfceMV5aam`. The request is in `music/loop_source_v1_request.json`. The 60 s loop is an edit of that take, cut on bar lines by `tools/make_loop.py`. |
| Sound effects | `sfx/*.mp3` (10 files) | ElevenLabs sound generation, model `eleven_text_to_sound_v2`. Every prompt is in `sfx/sfx_requests.json`. |
| Mix and stems | `mix_provisional.wav` / `.mp3`, `stems/vo.wav`, `stems/music.wav`, `stems/sfx.wav` | Our own mix of the files above (`tools/mix.py`, ffmpeg and numpy). It adds no outside material. |

Speech-to-text checks of the narration and the mix used ElevenLabs `scribe_v1`. The music beds were also checked this way, and no words came back from either, so neither has vocals.

## Use

- Use is governed by **ElevenLabs' terms for the founder's plan**. ElevenLabs says output made on paid plans may be used commercially, and that includes Voice Library voices used under the library's terms.
- **Before the film is shown outside the company or posted publicly, check two things:**
  - that the plan covers client presentations and public posting;
  - that the Alka S voice's Voice Library listing has no extra limits.
- Some places expect AI-generated voice and music to be disclosed. If the film is published, add a credit line such as "Voice and music generated with ElevenLabs".
- The narration speaks Autopilot's own figures and the facts in the script. The voice is not a real person, and it must not be presented as one.
