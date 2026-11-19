# Lisa narration revision

The user auditioned Lisa's library sample and explicitly approved adding and using
her on 20 November 2026. Voice: Lisa – Warm Indian English, ElevenLabs
`CQeA7YDuX8jSli58KbVp`, multilingual v2. No cloning or pitch shifting.

`generate.py` makes one continuous take for each output. `assemble.py` fits its
paragraphs to the existing picture with pitch-preserving tempo adjustment. The
first word of “Welcome to Reliable Tech Park” is trimmed to its alignment onset,
then placed at 41.6 seconds on the website and 45 seconds in the film.

The location script uses the existing founder-supplied Google Maps walking figure
in `../../demo/data/route.json`: 1.3 km, approximately 17 minutes. Airoli is described
as a station; the script does not present a proposed metro as operating.

Bus service at Reliable Plaza is listed by
[Moovit](https://moovitapp.com/index/en/public_transit-Reliable_Plaza-Mumbai-stop_33976515-3732).
The user's brief also reports shared rickshaws for the last mile. The narration
mentions these options without claiming a verified combined frequency, fare,
guaranteed availability, or commute time by vehicle.

The corrected blue route is sampled along the rendered terrain, completes before
the camera approaches the gate, and stays visible until the direct CAD handoff.
The entrance approach finishes at ground level, without the former partial lift
ascent. The CAD geometry and sourced route endpoints are retained.

Regenerate locally from the repository root:

```sh
python3 airoli-rtp/film/narration-v3/generate.py
python3 airoli-rtp/film/narration-v3/assemble.py
node airoli-rtp/film/tools/capture_route.mjs
npm run test:rtp
```

Generation refuses to overwrite a take; select a new take name first. Credentials
are read by the existing local helper and are never written into runtime files.
Generation masters and MP4 exports remain local. The website's Lisa MP3 and SRT
are the published runtime assets.
