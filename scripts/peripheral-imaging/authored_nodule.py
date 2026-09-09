"""Shared authored nodule parameters; coordinates/radius default to the TS physics contract."""
import json
import os
from pathlib import Path
import re
import numpy as np


def parameters():
    root = Path(__file__).resolve().parents[2]
    physics = (root / 'src/features/peripheral-imaging/lib/physics.ts').read_text()
    center = json.loads('[' + re.search(r'LESION_CENTER: Point3 = \[([^\]]+)\]', physics).group(1) + ']')
    radius = float(re.search(r'LESION_RADIUS = ([0-9.]+)', physics).group(1))
    center = json.loads(os.environ.get('IMAGING_NODULE_CENTER_MM', json.dumps(center)))
    radius = float(os.environ.get('IMAGING_NODULE_RADIUS_MM', radius))
    core_hu = float(os.environ.get('IMAGING_NODULE_CORE_HU', -350))
    core_fraction = float(os.environ.get('IMAGING_NODULE_CORE_FRACTION', .45))
    assert len(center) == 3 and np.isfinite(center).all()
    assert 0 < radius <= 30 and -900 <= core_hu <= 100 and 0 < core_fraction < 1
    return {'centerMm': center, 'radiusMm': radius, 'coreRadiusMm': radius * core_fraction,
            'coreHu': core_hu, 'profile': 'part-solid core with smoothstep blend into unchanged CT lung',
            'provenance': 'Authored teaching construct, 2026-09-08; not an observed source-CT finding'}


def bake(hu, origin_xyz, spacing_xyz, model):
    z, y, x = np.ogrid[:hu.shape[0], :hu.shape[1], :hu.shape[2]]
    x = x * spacing_xyz[0] + origin_xyz[0] - model['centerMm'][0]
    y = y * spacing_xyz[1] + origin_xyz[1] - model['centerMm'][1]
    z = z * spacing_xyz[2] + origin_xyz[2] - model['centerMm'][2]
    distance = np.sqrt(x*x + y*y + z*z)
    t = np.clip((model['radiusMm'] - distance) / (model['radiusMm'] - model['coreRadiusMm']), 0, 1)
    weight = t*t*(3-2*t)
    # Preserve both values and float32 rounding outside the sphere. Promoting the whole
    # volume to float64 changes a few unrelated quantization ties on re-encoding.
    result = hu.copy()
    inside = weight > 0
    mixed = hu*(1-weight) + model['coreHu']*weight
    result[inside] = mixed[inside]
    return result
