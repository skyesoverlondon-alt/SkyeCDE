# SkyDexia

SkyDexia is the upgraded SkyDex build that lives under the SkyeCDE hub.

Rules:
- SkyDex remains the original product.
- SkyDexia is additive.
- Theia supplies support-layer coding systems.
- Full app launches only for app pages. No preview widgets.

Implemented lane controls
- Dedicated multi-page operating shell instead of one stacked lane surface
- Shared bridge-backed workspace browse, recursive load, reload, and directory create
- Shared bridge-backed file read and write flows
- Shared bridge-backed runtime start, live log follow, restart, and stop
- Shared bridge-backed rename, move, and delete flows for safe repo-root paths
- Dedicated GitHub and cloud posture page with artifact generation
- Dedicated mail and identity posture page with artifact generation
- Dedicated sovereign controls page with artifact generation
- Universal panel contract: every section is scrollable, collapsible, and minimizable
- Lane-owned SkyDexia workspace defaults, runtime recipes, launch map, session identity, operating model, and visual layer

Lane-owned source files
- src/skydexia-workspace-bridge.js
- src/skydexia-file-actions.js
- src/skydexia-terminal-actions.js
- src/skydexia-session-bridge.js
- src/skydexia-launch-map.js
- src/skydexia-operating-model.js
- src/skydexia-preview-actions.js
- src/skydexia-renderer.js
- src/skydexia-layout.css
- src/skydexia-shell.js

Lane-owned operational assets
- deployment/SKYDEXIA_DEPLOYMENT_SYSTEMS.md
- ops/SKYDEXIA_RUNTIME_RUNBOOK.md
- delivery/SKYDEXIA_RELEASE_COMMAND_CENTER.md

SkyDexia-specific enterprise depth
- deployment and release workspace pack for lane-owned rollout assets
- rollout plan and environment audit artifact generators
- deployment guide and release-ops validation checks
- release operations and incident desk workflows scoped to SkyDexia only