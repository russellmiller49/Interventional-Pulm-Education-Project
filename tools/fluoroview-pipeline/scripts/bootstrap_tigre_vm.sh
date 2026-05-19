#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="${FLUOROVIEW_TIGRE_ENV:-fluoroview-tigre}"
TIGRE_DIR="${TIGRE_DIR:-$HOME/src/TIGRE}"

echo "== FluoroView TIGRE VM bootstrap =="
echo "Environment: ${ENV_NAME}"
echo "TIGRE dir: ${TIGRE_DIR}"

command -v nvidia-smi >/dev/null || {
  echo "nvidia-smi not found. Use an NVIDIA CUDA VM image before running this script." >&2
  exit 1
}
nvidia-smi

command -v nvcc >/dev/null || {
  echo "nvcc not found. Install the CUDA Toolkit matching your VM driver." >&2
  exit 1
}
nvcc --version

command -v gcc >/dev/null || {
  echo "gcc not found. Install build-essential." >&2
  exit 1
}
gcc --version | head -1

df -h .

if ! command -v conda >/dev/null; then
  echo "conda not found. Install Miniconda or use a CUDA conda image." >&2
  exit 1
fi

conda env update --name "${ENV_NAME}" --file environment-tigre.yml --prune

if [ ! -d "${TIGRE_DIR}/.git" ]; then
  mkdir -p "$(dirname "${TIGRE_DIR}")"
  git clone https://github.com/CERN/TIGRE.git "${TIGRE_DIR}"
fi

conda run -n "${ENV_NAME}" python -m pip install --upgrade pip
conda run -n "${ENV_NAME}" python -m pip install -e .
conda run -n "${ENV_NAME}" python -m pip install "${TIGRE_DIR}/Python"
conda run -n "${ENV_NAME}" python scripts/tigre_smoke_test.py

echo "TIGRE VM bootstrap complete."

