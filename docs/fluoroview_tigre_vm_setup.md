# FluoroView TIGRE VM Setup

This document prepares the optional GPU step for generating higher-fidelity DRR atlas assets.
The local website and CPU pipeline must continue to work without TIGRE.

## VM Target

- Ubuntu 22.04 or 24.04 NVIDIA CUDA image.
- One NVIDIA GPU with at least 16 GB VRAM preferred. T4, L4, or A10 class hardware is acceptable for the first atlas job.
- 8 or more vCPU.
- 32 GB RAM or more.
- 250 GB disk or more.

## Safety And Data Handling

Raw DICOM, raw NIfTI, and raw segmentation volumes must not be committed. Transfer only the inputs
needed for projection into a temporary VM workspace, then return only derived educational assets.

Recommended bundle contents:

- DICOM series or CT volume needed for projection.
- Airway segmentation/centerline assets needed for alignment checks.
- A non-PHI manifest describing file names, checksums, coordinate system, and intended output case id.

Recommended transfer:

```bash
tar --zstd -cf fluoroview-patient-4-source.tar.zst fluoro_2
shasum -a 256 fluoroview-patient-4-source.tar.zst > fluoroview-patient-4-source.sha256
rsync -avP fluoroview-patient-4-source.tar.zst fluoroview-patient-4-source.sha256 VM_HOST:/data/fluoroview/
```

Keep the bundle outside git. Delete it from the VM after derived assets have been copied back.

## Bootstrap

From `tools/fluoroview-pipeline` on the VM:

```bash
./scripts/bootstrap_tigre_vm.sh
```

The script verifies:

- `nvidia-smi`
- CUDA Toolkit and `nvcc`
- `gcc`
- disk space
- conda environment creation
- TIGRE source install
- project TIGRE smoke projection

## Atlas Job

After unpacking the temporary source bundle on the VM:

```bash
conda activate fluoroview-tigre
python scripts/run_tigre_atlas_job.py \
  --dicom-dir /data/fluoroview/fluoro_2/DICOM \
  --output-dir /data/fluoroview/derived/patient-4/drr \
  --detector-sizes 512,1024
```

Current caveat: this repository revision's `TigreProjector` verifies TIGRE import availability but
still delegates projection math to the CPU ray-sum placeholder. Until true TIGRE geometry is wired
in and rerun, generated exports must be labeled `tigre-placeholder`, even when produced on a VM with
TIGRE installed.

Copy only derived outputs back into a local ignored review folder such as `fluoro_2/drr-full/`.
Then ingest the preferred detector export into the deployable case assets:

```bash
python tools/fluoroview-pipeline/scripts/ingest_drr_atlas_export.py \
  --atlas-dir fluoro_2/drr-full/1024x1024 \
  --case-dir public/fluoroview/cases/patient-4 \
  --backend-label tigre-placeholder \
  --flip-vertical \
  --tone-map fluoro
```

The ingest step copies only PNG frames and non-PHI JSON/TXT metadata into `public/fluoroview`.
It does not copy raw DICOM, NIfTI, NRRD, STL, OBJ, or `.npy` arrays.
The `--flip-vertical` display-plane correction keeps the DRR atlas anatomically upright in the
browser while preserving the original VM export arrays in the ignored source folder.
The `--tone-map fluoro` step converts the very dark normalized projector PNGs into a
fluoroscopy-like display range with visible chest midtones; it does not alter the ignored source
arrays.

## Teardown Checklist

- Confirm derived atlas assets copied back.
- Confirm checksums or file counts match the generated manifest.
- Delete raw source bundles and unpacked raw data from the VM.
- Stop or destroy the GPU VM to avoid idle cost.
- Keep local CPU projector tests passing after adding TIGRE outputs.

## References

- CERN/TIGRE Python installation: https://github.com/CERN/TIGRE/blob/master/Frontispiece/python_installation.md
- NVIDIA CUDA Linux installation guide: https://docs.nvidia.com/cuda/cuda-installation-guide-linux/
