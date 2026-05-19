"""Smoke-test CUDA/TIGRE availability on the GPU VM."""

from __future__ import annotations

from pathlib import Path
import platform
import subprocess

import numpy as np

from fluoroview_pipeline.drr.base import ProjectionOptions
from fluoroview_pipeline.drr.tigre_projector import TigreProjector, is_available
from fluoroview_pipeline.examples.synthetic_phantoms import create_synthetic_chest_phantom
from fluoroview_pipeline.geometry.carm import CArmGeometry


def main() -> None:
    print(f"Python: {platform.python_version()}")
    try:
        result = subprocess.run(["nvidia-smi"], check=False, capture_output=True, text=True)
        print(result.stdout.strip())
    except FileNotFoundError:
        print("nvidia-smi unavailable")

    if not is_available():
        raise SystemExit("TIGRE import not available in this environment.")

    volume, spacing, _metadata = create_synthetic_chest_phantom(shape=(32, 48, 48))
    result = TigreProjector().project(
        volume,
        spacing,
        CArmGeometry(detector_shape=(64, 64)),
        ProjectionOptions(downsample=2),
    )
    if result.image.shape != (32, 32) or not np.isfinite(result.image).all():
        raise SystemExit(f"Unexpected TIGRE smoke projection output: {result.image.shape}")

    output_dir = Path("outputs")
    output_dir.mkdir(exist_ok=True)
    np.save(output_dir / "tigre_smoke_projection.npy", result.image)
    print(f"Wrote {output_dir / 'tigre_smoke_projection.npy'}")


if __name__ == "__main__":
    main()

