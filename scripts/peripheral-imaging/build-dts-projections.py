"""Run with Slicer's --python-script, after build-slicer-anatomy.py.

Produces parallel CT projections for a transparent shift-and-add teaching exercise.
This is deliberately not a clinical DTS or manufacturer reconstruction algorithm.
"""
import json
import hashlib
import os
from pathlib import Path
import traceback
import numpy as np
from scipy import ndimage
from PIL import Image
import slicer


def main():
    out = Path(os.environ['IMAGING_OUTPUT_DIR'])
    meta = json.loads((out/'manifest.json').read_text())
    if 'authoredNodule' not in meta:
        raise RuntimeError('Regenerate the CT atlas with its authored nodule before building DTS.')
    atlas = np.asarray(Image.open(out/'ct-atlas.png'))
    size = meta['sizeXyz'][0]
    encoded = np.stack([atlas[(z//16)*size:(z//16+1)*size, (z%16)*size:(z%16+1)*size] for z in range(size)])
    hu = encoded.astype(np.float32) / 255 * (meta['huRange'][1]-meta['huRange'][0]) + meta['huRange'][0]
    # Educational attenuation weighting; no physical spectrum or detector response.
    density = np.clip((hu+1000)/1000, 0, 3) + .7*np.clip((hu-150)/1000, 0, 2)
    z, y, x = np.ogrid[:size, :size, :size]
    center = meta['authoredNodule']['centerMm']
    x = x*meta['spacingMm'][0] + meta['originMm'][0] - center[0]
    y = y*meta['spacingMm'][1] + meta['originMm'][1] - center[1]
    z = z*meta['spacingMm'][2] + meta['originMm'][2] - center[2]
    # The same faint nodule is already in the atlas; never overwrite it with a denser sphere.
    tool = np.clip(1.8-np.sqrt((y+18)**2+z*z), 0, 1) * ((x>=-60)&(x<=0))
    density = density*(1-tool) + 8*tool
    sweeps = [20, 30, 40, 50, 60]
    projections = np.zeros((len(sweeps)*size, 13*size), dtype=np.uint8)
    cached = {}
    for row, sweep in enumerate(sweeps):
        for col, angle in enumerate(np.linspace(-sweep/2, sweep/2, 13)):
            key = round(float(angle), 6)
            if key not in cached:
                rotated = ndimage.rotate(density, angle, axes=(1, 2), reshape=False, order=1, prefilter=False)
                ray_sum = rotated.sum(axis=1) * meta['spacingMm'][1]
                # Suppress slowly varying background before refocusing. This is a simple
                # Gaussian high-pass teaching filter, not a vendor reconstruction kernel.
                detail = ray_sum - ndimage.gaussian_filter1d(ray_sum, 7, axis=1)
                cached[key] = np.clip(128 + detail*1.5, 0, 255).astype(np.uint8)
            projections[row*size:(row+1)*size, col*size:(col+1)*size] = cached[key]
        print('Completed sweep', sweep, flush=True)
    Image.fromarray(projections).save(out/'dts-projections.png', optimize=True)
    (out/'dts.json').write_text(json.dumps({
        'schema': 'peripheral-imaging-dts/v1', 'generator': '3D Slicer '+slicer.app.applicationVersion,
        'sourceSha256': meta['sourceSha256'],
        'sourceAtlasSha256': hashlib.sha256((out/'ct-atlas.png').read_bytes()).hexdigest(),
        'authoredNodule': meta['authoredNodule'],
        'sweeps': sweeps, 'viewsPerSweep': 13, 'tileSize': size,
        'originMm': meta['originMm'], 'spacingMm': meta['spacingMm'],
        'targetCenterMm': center, 'toolPlaneRelativeMm': -18,
        'filter': {'method': 'horizontal Gaussian high-pass', 'sigmaVoxels': 7, 'zeroValue': 128, 'encodingGain': 1.5},
        'method': 'Parallel ray sums of the derived FluoroView CT with an authored spherical target and straight instrument. A horizontal Gaussian high-pass suppresses background, then the browser refocuses by shift-and-add. No vendor algorithm, prior-CT registration, motion, scatter, or dose model.'
    }, indent=2)+'\n')


try:
    main()
except Exception:
    traceback.print_exc()
    slicer.app.exit(1)
else:
    slicer.app.exit(0)
