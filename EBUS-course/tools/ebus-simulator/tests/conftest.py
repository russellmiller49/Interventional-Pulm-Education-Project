from pathlib import Path

import pytest


TOOL_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def repo_root_env(monkeypatch):
    """Resolve ${REPO_ROOT} manifest tokens to the tool root, as the export CLI does.

    The bundled configs live under tools/ebus-simulator, not the git root that
    manifest loading would otherwise discover. Tests that exercise the discovery
    fallback delete REPO_ROOT themselves via monkeypatch.
    """
    monkeypatch.setenv("REPO_ROOT", str(TOOL_ROOT))
