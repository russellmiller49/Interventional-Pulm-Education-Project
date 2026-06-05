# LinkedIn Modules Promo

Square LinkedIn-ready promo video for interventionalpulm.com module signup.

## Output

- `interventionalpulm-linkedin-modules.mp4`
- `interventionalpulm-linkedin-modules-poster.png`

## Build

```bash
node marketing/linkedin-modules-promo/build-linkedin-video.mjs
```

The script renders `1080x1080` frames at `30 fps` and encodes an H.264 MP4 with
ffmpeg. It uses repo-local assets from:

- `public/socal-ebus-course/app/media/`
- `marketing/linkedin-modules-promo/screenshots/board-prep.png`

It also uses local screen-recorded clips from:

- `/Users/russellmiller/Movies/NAVBRONCH.mp4`
- `/Users/russellmiller/Movies/FLUORONAV.mp4`

The Navigation Trainer and FluoroView scenes run for the full duration of those
source clips. The script probes the MP4 durations automatically before rendering.

## Storyboard

1. Free interactive modules for IP learners
2. Bronch Navigation Trainer
3. FluoroView
4. EBUS Training
5. IP Board Review
6. Live module catalog and upcoming features
7. Free account signup

## Suggested LinkedIn Post

Free interventional pulmonology education modules are opening up.

Practice bronchoscopic navigation, CT-to-fluoro orientation, EBUS knobology and
station recognition, TNM-9 staging, 3D anatomy, Creative Commons image review,
and IP board prep in one browser-based learning lab.

Create a free account to access the modules and track progress across the
Navigation Trainer, FluoroView, EBUS Training, Board Review, TNM-9, 3D Anatomy,
and the Creative Commons image repository. New features are being built for
intro bronchoscopy, pleural disease, and rigid bronchoscopy foundations.

interventionalpulm.com
