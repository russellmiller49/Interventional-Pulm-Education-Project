#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CASE_PLUS_DIR="$REPO_ROOT/Pleural_effusion_simulation/plus"
CONFIG_FILE="$CASE_PLUS_DIR/PlusDeviceSet_PleuralEffusionSimulator.xml"
TRANSFORM_SENDER="$REPO_ROOT/scripts/pleural-ultrasound/plus/send-probe-transform.py"
POSE_FILE="${POSE_FILE:-$CASE_PLUS_DIR/current-probe-pose.json}"
PLUS_VERBOSE="${PLUS_VERBOSE:-3}"

if [[ -z "${PLUS_BIN:-}" ]]; then
  if [[ -x "$HOME/Projects/PlusBuild-bin/bin/PlusServer" ]]; then
    PLUS_BIN="$HOME/Projects/PlusBuild-bin/bin"
  else
    PLUS_BIN="$HOME/Projects/PlusBuild-bin/PlusLib-bin/bin"
  fi
fi

PLUS_SERVER="$PLUS_BIN/PlusServer"

if [[ ! -x "$PLUS_SERVER" ]]; then
  echo "Could not find PlusServer at: $PLUS_SERVER"
  echo "Set PLUS_BIN to your PLUS bin directory, for example:"
  echo "  PLUS_BIN=/path/to/PlusLib-bin/bin $0"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing config: $CONFIG_FILE"
  echo "Create it from the template:"
  echo "  mkdir -p '$CASE_PLUS_DIR'"
  echo "  cp '$REPO_ROOT/scripts/pleural-ultrasound/plus/PlusDeviceSet_PleuralEffusionSimulator.template.xml' '$CONFIG_FILE'"
  exit 1
fi

MODEL_DIR="$CASE_PLUS_DIR/ModelsLowRes"

missing=0
for model in skin.stl muscle.stl rib.stl lung.stl right-pleural-effusion.stl diaphragm.stl liver.stl spleen.stl; do
  if [[ ! -f "$MODEL_DIR/$model" ]]; then
    echo "Missing model: $MODEL_DIR/$model"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Export the STL surfaces from 3D Slicer, then generate low-res PLUS surfaces:"
  echo "  /Applications/Slicer.app/Contents/bin/PythonSlicer '$REPO_ROOT/scripts/pleural-ultrasound/plus/decimate-plus-surfaces.py'"
  exit 1
fi

if [[ ! -f "$POSE_FILE" ]]; then
  cat > "$POSE_FILE" <<'JSON'
{
  "name": "largest-pocket",
  "rx": 0.0,
  "ry": 0.0,
  "rz": 0.0,
  "x": 184.2,
  "y": 110.4,
  "z": -382.9
}
JSON
fi

sender_pid=""
cleanup() {
  if [[ -n "$sender_pid" ]]; then
    kill "$sender_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "${START_TRANSFORM_SENDER:-1}" != "0" ]]; then
  python3 "$TRANSFORM_SENDER" --rate "${TRANSFORM_RATE:-30}" --pose-file "$POSE_FILE" ${TRANSFORM_SENDER_ARGS:-} &
  sender_pid="$!"
  sleep 0.5
fi

"$PLUS_SERVER" \
  --config-file="$CONFIG_FILE" \
  --verbose="$PLUS_VERBOSE" \
  "$@"
