#!/usr/bin/env bash
set -euo pipefail
docker pull ghcr.io/eclipse-theia/theia-ide/theia-ide:latest
docker run --rm --name skye-theia \
  -p 3000:3000 \
  -v "$PWD:/workspace" \
  ghcr.io/eclipse-theia/theia-ide/theia-ide:latest
