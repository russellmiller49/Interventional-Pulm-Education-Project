#!/usr/bin/env python3
"""Render cropped learner-facing bronchoscopy video assets.

The source bronchoscopy video includes a left-side metadata panel. The intro
anatomy lesson teaches from the bronchoscopy field only, so this script crops
the source to the endoscopic image, scales it to web-friendly 720 px height, and
writes the video/poster files referenced by airway-survey-overlays.json.
"""
import os
import subprocess
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC_VIDEO = os.environ.get(
    "AIRWAY_SOURCE_VIDEO",
    os.path.join(REPO, "normal_airway_anotated_video", "V0002.mp4"),
)
OUT_DIR = os.path.join(REPO, "public", "airway-lesson")
OUT_VIDEO = os.path.join(OUT_DIR, "airway-survey-cropped.mp4")
OUT_POSTER = os.path.join(OUT_DIR, "airway-survey-poster-cropped.jpg")

CROP_X, CROP_Y, CROP_W, CROP_H = 552, 0, 1368, 1080
OUT_W, OUT_H = 912, 720
POSTER_TIME_SECONDS = 8.5


def run(cmd):
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)


def main():
    if not os.path.exists(SRC_VIDEO):
        sys.exit(f"source video not found: {SRC_VIDEO}")
    os.makedirs(OUT_DIR, exist_ok=True)

    vf = f"crop={CROP_W}:{CROP_H}:{CROP_X}:{CROP_Y},scale={OUT_W}:{OUT_H}:flags=lanczos"
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-i", SRC_VIDEO,
        "-vf", vf,
        "-c:v", "libx264",
        "-profile:v", "high",
        "-preset", "slow",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        OUT_VIDEO,
    ])
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", str(POSTER_TIME_SECONDS),
        "-i", SRC_VIDEO,
        "-frames:v", "1",
        "-vf", vf,
        "-q:v", "3",
        OUT_POSTER,
    ])
    print(f"wrote {OUT_VIDEO}")
    print(f"wrote {OUT_POSTER}")


if __name__ == "__main__":
    main()
