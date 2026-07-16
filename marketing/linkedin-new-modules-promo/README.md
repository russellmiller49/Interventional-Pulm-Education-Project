# LinkedIn New Modules Promo

LinkedIn 4:5 feed video featuring the July 2026 launches:

- Therapeutic Bronchoscopy collection
- Rigid Bronchoscopy 3D assembly and airway-orientation lab
- Airway Stent Mechanics silicone and self-expanding stent explorer
- Laser Ablation power-density and tissue-response lab
- Thermal Ablation simulated VIO 3 / APC tissue lab
- Peripheral Lung Tumor Ablation zone and margin simulator
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
target duration of 48.8 seconds. All essential messaging is burned in because
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

- Thermal ablation: `/thermal-ablation/index.html#sim`
- Laser power-density lab: `/thermal-ablation/index.html#power`
- Peripheral ablation: `/peripheral-ablation/index.html#simulator`
- EBUS simulator: `/socal-ebus-course/app/index.html?locale=en&publicTraining=1&publicScope=ebus#/simulator`
- Tracheostomy: `/en/tracheostomy/learn`

The user-supplied `Rigid_demo.mp4` and `stent.mp4` clips were copied unchanged
into `sources/` so the build is reproducible and the Desktop originals remain
untouched. The build trims and retimes those clips, removes their source audio,
and uses them full-frame. Source hashes and trim windows are recorded in the
manifest.

The EBUS app under `public/socal-ebus-course/app` is a generated sync output from
`/Users/russellmiller/Projects/EBUS-course`; it was captured, not hand-edited.
The VIO 3 scene is labeled as a schematic teaching replica and does not imply
manufacturer endorsement or clinical validation.

The laser and peripheral-ablation scenes are labeled as schematic educational
models rather than procedural guidance or dosimetry. PEF for lung and
bronchoscopic/transbronchial ablation remain investigational and are identified
that way on-screen.

## Storyboard

1. New interactive modules hook
2. Rigid bronchoscopy component assembly and airway placement
3. Silicone deformation and self-expanding stent architecture
4. KTP laser power-density and simulated tissue response
5. Simulated VIO 3 mode selection and APC tissue response
6. Peripheral RFA heat-sink and PEF target-margin comparison
7. Updated synchronized EBUS tri-view simulator
8. Tracheostomy 3D rotation and exploded components
9. Free-account call to action

## Suggested LinkedIn post

New interactive modules are live at interventionalpulm.com.

Assemble a rigid bronchoscope in 3D, compare silicone and self-expanding airway
stent mechanics, sweep a laser across simulated tissue, drive a simulated VIO 3
electrosurgery console, compare peripheral-ablation zones and target margins,
navigate the updated EBUS anatomy-correlation simulator, and build a practical
tracheostomy mental model with a segmented 3D tube.

Built for visual, practice-first interventional pulmonology education.

Create a free account at interventionalpulm.com.

Educational simulation only.

## Narration script

Read with a confident, conversational delivery at about 125 words per minute.

- **0:00–0:03 — Hook:** Explore new interactive modules from Interventional Pulm.
- **0:03–0:09.8 — Rigid bronchoscopy:** Assemble a rigid bronchoscope in 3D, then translate its orientation into deliberate airway positioning.
- **0:09.8–0:16.6 — Airway stents:** Compare silicone and self-expanding stents, revealing deformation, wall contact, and design mechanics.
- **0:16.6–0:20.8 — Laser:** Adjust laser power density and watch simulated tissue respond.
- **0:20.8–0:26.8 — VIO 3:** Drive a simulated VIO 3 console and visualize argon plasma coagulation at the tissue surface.
- **0:26.8–0:31.4 — Peripheral ablation:** For peripheral lesions, reveal heat-sink and test the target margin.
- **0:31.4–0:37.4 — EBUS:** Navigate updated EBUS with synchronized anatomy, scope, and ultrasound views.
- **0:37.4–0:43.4 — Tracheostomy:** Rotate and explode a tracheostomy tube to understand every component.
- **0:43.4–0:48.8 — Call to action:** Practice between cases. Create a free account at interventionalpulm.com. Educational simulation only.

Pronounce “EBUS” as “EE-bus,” “VIO 3” as “VEE-oh three,” and the URL as
“interventional pulm dot com.”
