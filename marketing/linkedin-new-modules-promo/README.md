# LinkedIn New Modules Promo

LinkedIn 4:5 feed video featuring the July 2026 launches:

- Therapeutic Bronchoscopy collection
- Airway Stent Mechanics 3D explorer
- Thermal Ablation simulated VIO 3 / APC tissue lab
- Updated EBUS anatomy-correlation simulator
- Tracheostomy Knowledge Lab segmented 3D model

## Output

- `interventionalpulm-linkedin-new-modules.mp4`
- `interventionalpulm-linkedin-new-modules-poster.png`
- `interventionalpulm-linkedin-new-modules.ffprobe.json`
- `interventionalpulm-linkedin-new-modules-contact-sheet.png`
- `interventionalpulm-linkedin-new-modules-manifest.json`
- `review/` scene-boundary stills

The final is `1080x1350`, `30 fps`, H.264 High / yuv420p with AAC audio and a
target duration of 39 seconds. All essential messaging is burned in because
LinkedIn often autoplays muted.

## Build

```bash
node marketing/linkedin-new-modules-promo/build-linkedin-new-modules-video.mjs
```

The build uses the existing marketing music at
`/Users/russellmiller/Movies/promption_audio.mp3` when present. Override it with:

```bash
LINKEDIN_PROMO_AUDIO=/absolute/path/to/music.mp3 \
  node marketing/linkedin-new-modules-promo/build-linkedin-new-modules-video.mjs
```

If no audio is available, the script still produces a silent LinkedIn-ready MP4.

## Capture provenance

The browser captures in `captures/` were recorded from the local app at a fixed
desktop viewport. No local-auth token or authentication URL appears on screen.

- Therapeutic hub: `/en/therapeutic-bronchoscopy`
- Airway stent mechanics: `/en/airway-stent-mechanics`
- Thermal ablation: `/thermal-ablation/index.html#sim`
- EBUS simulator: `/socal-ebus-course/app/index.html?locale=en&publicTraining=1&publicScope=ebus#/simulator`
- Tracheostomy: `/en/tracheostomy/learn`

The EBUS app under `public/socal-ebus-course/app` is a generated sync output from
`/Users/russellmiller/Projects/EBUS-course`; it was captured, not hand-edited.
The VIO 3 scene is labeled as a schematic teaching replica and does not imply
manufacturer endorsement or clinical validation.

## Storyboard

1. New interactive modules hook
2. Therapeutic Bronchoscopy collection
3. 3D Y-stent mechanics
4. Simulated VIO 3 mode selection and APC tissue response
5. Updated synchronized EBUS tri-view simulator
6. Tracheostomy 3D rotation and exploded components
7. Free-account call to action

## Suggested LinkedIn post

New interactive modules are live at interventionalpulm.com.

Explore the Therapeutic Bronchoscopy collection, drive a simulated VIO 3
electrosurgery console, inspect airway-stent mechanics in 3D, navigate the
updated EBUS anatomy-correlation simulator, and build a practical tracheostomy
mental model with a segmented 3D tube.

Built for visual, practice-first interventional pulmonology education.

Create a free account at interventionalpulm.com.

Educational simulation only.
