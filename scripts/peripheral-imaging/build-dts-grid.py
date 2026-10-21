"""Off-centre DTS projections on one angle grid, for sweeps whose centre is not frontal.

Run with Slicer's Python, after build-slicer-anatomy.py and build-dts-projections.py:

    IMAGING_OUTPUT_DIR=public/peripheral-imaging/anatomy \
      /Applications/Slicer.app/Contents/bin/PythonSlicer scripts/peripheral-imaging/build-dts-grid.py

The symmetric sweeps keep their own atlas (dts-projections.png). This one holds the same parallel,
high-pass-filtered projections at every multiple of 5/6 degree from -60 to +60: the thirteen views
of every arc width the course offers (20 to 60 degrees) centred on any multiple of 10 degrees up to
+/-30 fall on it. It is loaded only when a learner moves the centre of the arc.

The projection is the one build-dts-projections.py makes, line for line: the same educational
attenuation weighting, the same authored instrument and the same filter. This is deliberately not
a clinical DTS or manufacturer reconstruction algorithm.
"""
import hashlib
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

STEP_NUMERATOR, STEP_DENOMINATOR = 5, 6  # degrees
K_MIN, K_MAX = -72, 72  # -60 to +60 degrees
COLUMNS = 13


def main():
    out = Path(os.environ['IMAGING_OUTPUT_DIR'])
    meta = json.loads((out / 'manifest.json').read_text())
    if 'authoredNodule' not in meta:
        raise RuntimeError('Regenerate the CT atlas with its authored nodule before building DTS.')
    atlas = np.asarray(Image.open(out / 'ct-atlas.png'))
    size = meta['sizeXyz'][0]
    encoded = np.stack(
        [atlas[(z // 16) * size:(z // 16 + 1) * size, (z % 16) * size:(z % 16 + 1) * size] for z in range(size)]
    )
    hu = encoded.astype(np.float32) / 255 * (meta['huRange'][1] - meta['huRange'][0]) + meta['huRange'][0]
    density = np.clip((hu + 1000) / 1000, 0, 3) + .7 * np.clip((hu - 150) / 1000, 0, 2)
    z, y, x = np.ogrid[:size, :size, :size]
    center = meta['authoredNodule']['centerMm']
    x = x * meta['spacingMm'][0] + meta['originMm'][0] - center[0]
    y = y * meta['spacingMm'][1] + meta['originMm'][1] - center[1]
    z = z * meta['spacingMm'][2] + meta['originMm'][2] - center[2]
    tool = np.clip(1.8 - np.sqrt((y + 18) ** 2 + z * z), 0, 1) * ((x >= -60) & (x <= 0))
    density = density * (1 - tool) + 8 * tool

    ks = list(range(K_MIN, K_MAX + 1))
    rows = (len(ks) + COLUMNS - 1) // COLUMNS
    grid = np.full((rows * size, COLUMNS * size), 128, dtype=np.uint8)
    for index, k in enumerate(ks):
        angle = k * STEP_NUMERATOR / STEP_DENOMINATOR
        rotated = ndimage.rotate(density, angle, axes=(1, 2), reshape=False, order=1, prefilter=False)
        ray_sum = rotated.sum(axis=1) * meta['spacingMm'][1]
        detail = ray_sum - ndimage.gaussian_filter1d(ray_sum, 7, axis=1)
        tile = np.clip(128 + detail * 1.5, 0, 255).astype(np.uint8)
        row, col = divmod(index, COLUMNS)
        grid[row * size:(row + 1) * size, col * size:(col + 1) * size] = tile
        if index % 13 == 12:
            print('Completed through', angle, 'degrees', flush=True)
    Image.fromarray(grid).save(out / 'dts-grid.png', optimize=True)
    (out / 'dts-grid.json').write_text(json.dumps({
        'schema': 'peripheral-imaging-dts-grid/v1',
        'generator': 'scripts/peripheral-imaging/build-dts-grid.py (Slicer Python)',
        'sourceSha256': meta['sourceSha256'],
        'sourceAtlasSha256': hashlib.sha256((out / 'ct-atlas.png').read_bytes()).hexdigest(),
        'angleStepDeg': {'numerator': STEP_NUMERATOR, 'denominator': STEP_DENOMINATOR},
        'kMin': K_MIN,
        'kMax': K_MAX,
        'columns': COLUMNS,
        'tileSize': size,
        'method': 'The same parallel ray sums, instrument and horizontal Gaussian high-pass as dts-projections.png, at every multiple of 5/6 degree from -60 to +60.',
    }, indent=2) + '\n')


main()
