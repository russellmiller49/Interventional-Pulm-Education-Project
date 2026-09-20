"""Union bounding box of lit pixels across sampled frames of the recorded EBUS clips.

Companion to measure-recorded-sector.mjs (EBUS-PRE-REVIEW-02, lane A). Reads the PNG frames that
script extracts and prints, per depth file, where the recorded content actually sits inside the
1920x1080 frame, plus every sampled frame that also carries the device banner.
"""

import glob
import sys

import numpy as np
from PIL import Image

LUMA_FLOOR = 12
BANNER_ABOVE = 60
BANNER_BELOW = 960

per: dict[str, list] = {}
for path in sorted(glob.glob(sys.argv[1] + "/*.png")):
    mask = np.asarray(Image.open(path).convert("L")) > LUMA_FLOOR
    cols, rows = np.where(mask.any(0))[0], np.where(mask.any(1))[0]
    if not len(cols):
        continue
    depth = path.split("/")[-1].split("_")[0][1:]
    per.setdefault(depth, []).append(
        (int(cols[0]), int(rows[0]), int(cols[-1]), int(rows[-1]), path.split("/")[-1])
    )

steady = []
for depth, boxes in sorted(per.items(), key=lambda kv: int(kv[0])):
    plain = [b for b in boxes if b[1] >= BANNER_ABOVE and b[3] <= BANNER_BELOW]
    arr = np.array([b[:4] for b in plain])
    steady.append(arr)
    print(
        "Depth%-2s frames=%-3d (%d without the banner)  x %d..%d  y %d..%d"
        % (depth, len(boxes), len(plain), arr[:, 0].min(), arr[:, 2].max(), arr[:, 1].min(), arr[:, 3].max())
    )
    for b in boxes:
        if b[1] < BANNER_ABOVE or b[3] > BANNER_BELOW:
            print("    device banner visible in", b[4], b[:4])

union = np.concatenate(steady)
print(
    "\nUnion over the frames without the banner: x %d..%d  y %d..%d  (%d x %d)"
    % (
        union[:, 0].min(),
        union[:, 2].max(),
        union[:, 1].min(),
        union[:, 3].max(),
        union[:, 2].max() - union[:, 0].min() + 1,
        union[:, 3].max() - union[:, 1].min() + 1,
    )
)
