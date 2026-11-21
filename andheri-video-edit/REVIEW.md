# Andheri East walkthrough review

Three client walkthroughs are cut from the labeled `Andheri Property Visits ` folder. The user confirmed that the loose `13th floor left wing .MOV` belongs to 723 Avenue. The loose `left wing .MOV` duplicates the Privilon source and is used only once.

The exact retained source windows and on-screen labels are in `edit-plan.json`. Entrances, obstructed passages and unnecessary walking were trimmed. Corporate Avenue's source numbers are labeled as walkthrough numbers, avoiding an unsupported claim about actual building floors. Portrait framing is preserved. The source remains handheld; no claim of full camera stabilization is made.

Every delivery is H.264, 720 × 960, 30 fps, yuv420p, with a fast-start MP4 header and zero audio streams. Phone HLG footage is converted to SDR BT.709 before labels are applied. Each ends with the same two-second Autopilot logo animation rendered from `index.html`.

The outro passed HyperFrames check with zero errors. The nested two-second lockup warning is acceptable for this small reusable asset; the empty initial frame is a deliberate fade from the preceding footage, and is not used as the gallery poster. The outro's centered logo and final scale/fade were visually inspected. Original footage is unchanged.

All final MP4s were decoded end-to-end without errors, checked with ffprobe, and visually reviewed as source frames and final contact sheets. Real playback was verified in installed Google Chrome at 1400 px and 390 px widths for every property. All six checks played past 0.25 seconds, loaded full metadata without media errors, and stayed within the viewport. The map was stubbed for these focused media/layout checks; a live-map check follows on the review deployment.

The existing 723 Avenue photos retain their photo-lightbox interaction. Videos use native playback and fullscreen controls, posters and metadata preload, with no autoplay.

`verification.json` records final sizes, durations and edit provenance. `storage-verification.json` records verified storage URLs and hashes after upload. Secret keys are never written to either report.

Storage verification completed: eight assets are uploaded to content-derived paths in the existing public `atlas-cms` bucket. Public HEAD checks matched every size and MIME type; MP4 range streaming returned HTTP 206. All six desktop/phone playback checks passed again using the uploaded URLs. The engine regression suite passed all 13 layouts. The protected review deployment is READY and its served bundle was independently checked for the three shortlisted options and remote gallery addresses. Production was not changed. See `deployment-verification.json` for the review URL and full-deployment handoff.

A final local check also loaded the real Mapbox canvas with all three option cards and storage-backed video metadata. The media playback assertions above are the definitive playback checks; a subsequent optional screenshot refresh was stopped after waiting on remote image loading.
