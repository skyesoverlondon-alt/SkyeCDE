# SkyDexia

SkyDexia is the upgraded SkyDex build that lives under the SkyeCDE hub.

Rules:
- SkyDex remains the original product.
- SkyDexia is additive.
- Theia supplies support-layer coding systems.
- Full app launches only for app pages. No preview widgets.

Implemented lane controls
- Shared bridge-backed workspace browse, recursive load, reload, and directory create
- Shared bridge-backed file read and write flows
- Shared bridge-backed runtime start, live log follow, restart, and stop
- Shared bridge-backed rename, move, and delete flows for safe repo-root paths
- Lane-owned SkyDexia workspace defaults, runtime recipes, launch map, session identity, and visual layer

Lane-owned source files
- src/skydexia-workspace-bridge.js
- src/skydexia-file-actions.js
- src/skydexia-terminal-actions.js
- src/skydexia-session-bridge.js
- src/skydexia-launch-map.js
- src/skydexia-preview-actions.js
- src/skydexia-layout.css
- src/skydexia-shell.js