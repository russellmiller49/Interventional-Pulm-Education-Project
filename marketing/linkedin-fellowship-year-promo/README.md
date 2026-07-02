# LinkedIn First Day Of Fellowship Promo

LinkedIn-ready 4:5 feed video for July 1, 2026, the first day of the 2026-2027 fellowship year.

## Output

- `interventionalpulm-linkedin-fellowship-year-2026-2027.mp4`
- `interventionalpulm-linkedin-fellowship-year-2026-2027-poster.png`
- `interventionalpulm-linkedin-fellowship-year-2026-2027.ffprobe.json`

## Build

```bash
node marketing/linkedin-fellowship-year-promo/build-linkedin-fellowship-video.mjs
```

The script renders `1080x1350` frames at `30 fps` and encodes a silent-first
H.264 MP4 with burned-in text for LinkedIn autoplay. It reads current podcast
and board-review counts from the repo data before rendering.

The final MP4 includes the background music from
`/Users/russellmiller/Movies/promption_audio.mp3`, mixed at background volume
with short fade-in and fade-out.

It also reuses real site visuals from the previous module promo:

- `marketing/linkedin-modules-promo/screenshots/home.png`
- `marketing/linkedin-modules-promo/screenshots/board-prep.png`
- `marketing/linkedin-modules-promo/screenshots/ebus-training.png`
- `marketing/linkedin-modules-promo/screenshots/navigation-wrapper.png`
- `marketing/linkedin-modules-promo/screenshots/fluoroview.png`
- `/Users/russellmiller/Movies/NAVBRONCH.mp4`
- `/Users/russellmiller/Movies/FLUORONAV.mp4`

Nav Bronch and FluoroView are composited into the module scene with ffmpeg
video overlays instead of per-frame SVG image embedding, which avoids flicker in
the exported MP4.

## Storyboard

1. Today is July 1. Fellowship starts now.
2. For incoming IP fellows: start with evidence, not scattered bookmarks.
3. New Landmark Study podcasts are ready.
4. 15 landmark episodes, 68 journal-club episodes, five languages.
5. Pair the literature with searchable IP Board Prep chapters, saved progress, and audio companions.
6. Ready for the year ahead: TNM-9, EBUS training, Nav Bronch, FluoroView.
7. Create a free account and start fellowship with practical tools.

## Suggested LinkedIn Post

Today is July 1, the first day of the 2026-2027 fellowship year.

For incoming interventional pulmonary fellows, I have been building
interventionalpulm.com as a free learning space for the year ahead: new
Landmark Study podcasts, multilingual journal-club episodes, IP board review
chapters, TNM-9 staging, EBUS training, Nav Bronch, and FluoroView.

Create a free account and start fellowship with tools you will actually use.

interventionalpulm.com

#InterventionalPulmonology #PulmonaryFellowship #MedEd #PulmCC #MedicalEducation
