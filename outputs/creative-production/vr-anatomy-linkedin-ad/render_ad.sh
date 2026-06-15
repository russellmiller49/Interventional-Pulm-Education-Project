#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/outputs/creative-production/vr-anatomy-linkedin-ad"
SRC="/Users/russellmiller/Movies/3D_Anatomy_1.mp4"
OUT="$ROOT/final/vr-anatomy-linkedin-ad-1920x1080.mp4"

ffmpeg -hide_banner -y \
  -i "$SRC" \
  -loop 1 -t 50.533 -i "$ROOT/overlays/constant_polish.png" \
  -loop 1 -t 4.20 -i "$ROOT/overlays/01_hook.png" \
  -loop 1 -t 6.40 -i "$ROOT/overlays/02_browser.png" \
  -loop 1 -t 3.40 -i "$ROOT/overlays/03_step_inside.png" \
  -loop 1 -t 9.45 -i "$ROOT/overlays/04_headsets.png" \
  -loop 1 -t 7.30 -i "$ROOT/overlays/05_spatial.png" \
  -loop 1 -t 9.90 -i "$ROOT/overlays/06_stent.png" \
  -loop 1 -t 9.50 -i "$ROOT/overlays/07_cta.png" \
  -filter_complex "\
    [0:v]fps=30,scale=1920:1080,format=rgba,eq=contrast=1.06:saturation=1.08:brightness=-0.012,unsharp=3:3:0.35:3:3:0.0[v0];\
    [1:v]fps=30,format=rgba[polish];\
    [v0][polish]overlay=0:0:eof_action=pass[v1];\
    [2:v]fps=30,format=rgba,fade=t=in:st=0:d=0.35:alpha=1,fade=t=out:st=3.75:d=0.45:alpha=1,setpts=PTS+0.35/TB[c1];\
    [v1][c1]overlay=0:0:eof_action=pass:enable='between(t,0.35,4.55)'[v2];\
    [3:v]fps=30,format=rgba,fade=t=in:st=0:d=0.28:alpha=1,fade=t=out:st=5.95:d=0.45:alpha=1,setpts=PTS+4.55/TB[c2];\
    [v2][c2]overlay=0:0:eof_action=pass:enable='between(t,4.55,10.95)'[v3];\
    [4:v]fps=30,format=rgba,fade=t=in:st=0:d=0.25:alpha=1,fade=t=out:st=2.92:d=0.45:alpha=1,setpts=PTS+10.95/TB[c3];\
    [v3][c3]overlay=0:0:eof_action=pass:enable='between(t,10.95,14.35)'[v4];\
    [5:v]fps=30,format=rgba,fade=t=in:st=0:d=0.30:alpha=1,fade=t=out:st=8.95:d=0.45:alpha=1,setpts=PTS+14.35/TB[c4];\
    [v4][c4]overlay=0:0:eof_action=pass:enable='between(t,14.35,23.80)'[v5];\
    [6:v]fps=30,format=rgba,fade=t=in:st=0:d=0.30:alpha=1,fade=t=out:st=6.80:d=0.45:alpha=1,setpts=PTS+23.80/TB[c5];\
    [v5][c5]overlay=0:0:eof_action=pass:enable='between(t,23.80,31.10)'[v6];\
    [7:v]fps=30,format=rgba,fade=t=in:st=0:d=0.30:alpha=1,fade=t=out:st=9.40:d=0.45:alpha=1,setpts=PTS+31.10/TB[c6];\
    [v6][c6]overlay=0:0:eof_action=pass:enable='between(t,31.10,41.00)'[v7];\
    [8:v]fps=30,format=rgba,fade=t=in:st=0:d=0.30:alpha=1,fade=t=out:st=8.95:d=0.45:alpha=1,setpts=PTS+41.00/TB[c7];\
    [v7][c7]overlay=0:0:eof_action=pass:enable='between(t,41.00,50.50)',format=yuv420p[vout]\
  " \
  -map "[vout]" -map 0:a? \
  -af "loudnorm=I=-16:LRA=11:TP=-1.5,afade=t=in:st=0:d=0.35,afade=t=out:st=49.65:d=0.85,aresample=48000" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart \
  "$OUT"

ffprobe -v error \
  -show_entries format=duration,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,duration \
  -of json "$OUT" > "$ROOT/final/vr-anatomy-linkedin-ad-1920x1080.ffprobe.json"

echo "$OUT"
