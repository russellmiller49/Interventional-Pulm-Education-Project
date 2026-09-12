"""Resolve the Interventional-Pulm-Local-Data root from Python authoring scripts.

That folder lives outside Git and holds raw authoring inputs, private references,
renders, and prompts the production build never reads. Folder map:
docs/local-authoring-assets.md.

Resolution order: ``IP_LOCAL_DATA`` environment variable, then the default path.

Usage from a script under ``scripts/``::

    REPO_ROOT = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from local_data import local_data_path

    SOURCE_DIR = local_data_path("raw-assets", "anatomy", "new_anatomy_module")
"""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_LOCAL_DATA_ROOT = Path("/Users/russellmiller/Projects/Interventional-Pulm-Local-Data")


def local_data_root() -> Path:
    from_env = os.environ.get("IP_LOCAL_DATA", "").strip()
    if from_env:
        return Path(from_env).expanduser().resolve()
    return DEFAULT_LOCAL_DATA_ROOT


def local_data_path(*parts: str) -> Path:
    return local_data_root().joinpath(*parts)


def require_local_data_path(*parts: str) -> Path:
    """Like local_data_path, but raises a readable error when the input is missing."""
    resolved = local_data_path(*parts)
    if not resolved.exists():
        raise FileNotFoundError(
            f"Local-Data input not found: {resolved}\n"
            "Set IP_LOCAL_DATA if the folder lives elsewhere. "
            "Folder map: docs/local-authoring-assets.md"
        )
    return resolved
