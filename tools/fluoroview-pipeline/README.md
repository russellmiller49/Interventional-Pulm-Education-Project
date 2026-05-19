# FluoroView Pipeline

Offline asset pipeline for the browser-based FluoroView educational simulator.

The pipeline converts local CT and airway source assets into derived, non-PHI web assets:

- CT slice tiles
- precomputed DRR atlas frames
- centerline and segment metadata
- validation images and manifests

Raw DICOM, NIfTI, and segmentation volumes should remain outside git. The public website should
only receive derived educational assets.

## Local CPU Workflow

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

## TIGRE Workflow

Use `environment-tigre.yml` and `scripts/bootstrap_tigre_vm.sh` on an NVIDIA CUDA Linux VM. TIGRE is
optional and must not be required for local tests or the deployed Next.js app.
