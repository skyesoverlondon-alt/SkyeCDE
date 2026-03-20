#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
TARGET_URL="${2:-https://0megaSkyeGate.example}"
python3 "$(dirname "$0")/omega_gate_truth_cutover.py" "$ROOT" "$TARGET_URL"
