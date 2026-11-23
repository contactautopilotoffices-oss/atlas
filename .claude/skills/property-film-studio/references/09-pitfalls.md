# 09: Pitfalls we hit, and the fix for each

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| A surveyed building (Fleet House) vanished | An old pin's tag deleted the footprint | Logic gate check 1; surveyed buildings live in `refs/*.json` |
| The hero was skewed −11.6° | Minimum-rectangle fit on an irregular outline | Wall-angle fit, length-weighted mod 90 (`--hero-fit`) |
| The hero overlapped a neighbour | The OSM outline was bigger than the real tower | A fixed outline in refs, plus trimming the neighbour with `note_trim` |
| The model faced the wrong way | Lost rotation on re-export | Verify north and west on a top render after every export |
| Renders took 80 s a frame | Wide camera, 24 samples | 16 samples, a tighter camera, two-pass frame-step plus interpolation |
| Renders stopped overnight | The session restarted and killed the job | `nohup` the queue, log to a file, write resumable queue scripts |
| Numbers collided or flickered | Digit wheels and blurred odometers | A plain count-up, tabular numbers, fixed min-width |
| The logo flickered | A corner logo over every cut | No persistent corner logo; the lockup at the end |
| Film playback stuttered | Playback-rate retiming, and GLB parsing during playback | minterpolate retime; gate Enter until the models are ready |
| The old building appeared after the film | The explorer loaded old models | `defaultPreview` loads the new d-preview GLBs for the branding |
| Wrong narration fact ("one stop") | The script wasn't checked against the map | Read every claim against the canonical table; re-record one line with `--force` |
| Headless Chromium couldn't play H.264 | Playwright's bundled Chromium | `channel: 'chrome'` |
| The film couldn't seek locally | The dev server has no byte ranges | Test on a Vercel preview |
| HTTP 408 on a big push | A large pack over HTTPS | Push commit by commit, raise `http.postBuffer` |
| zsh `$c:refs` broke a refspec | zsh's `:r` modifier | Write `${c}:refs/...` |
| The image viewer froze | Tool hooks timed out | Check by numbers, and **tell the founder** it wasn't seen by eye |
| `npx` download denied | The auto-mode safety classifier | Ask the founder before installing a tool |
| Merge blocked by uncommitted files | Another session's work in the folder | Merge in a temporary worktree, then remove it |

## Never

- Commit or print API keys, or put them in the journal or NotebookLM.
- Put Google imagery into any deliverable.
- Invent a figure, a floor or an amenity.
- Deploy to production without the founder's yes.
- Say "done" without saying what wasn't verified.
