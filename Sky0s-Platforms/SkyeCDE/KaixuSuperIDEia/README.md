# KaixuSuperIDEia

KaixuSuperIDEia is the SkyeCDE-hosted upgrade lane for KaixuSuper-IDE.

The original KaixuSuper-IDE platform remains intact.
This lane now ships with dedicated KaixuSuperIDEia source modules layered on top of the shared SkyeCDE bridge shell.

Implemented lane-owned sources:

- `src/kaixusuperideia-shell.js` wires the lane into the shared SkyeCDE shell.
- `src/kaixusuperideia-workspace-bridge.js` defines workspace defaults and live lane status.
- `src/kaixusuperideia-file-actions.js` defines file defaults, hints, and file workflow copy.
- `src/kaixusuperideia-terminal-actions.js` defines runtime recipes and runtime workflow copy.
- `src/kaixusuperideia-session-bridge.js` defines persistent lane session state.
- `src/kaixusuperideia-launch-map.js` defines full-app launch targets for the lane and the original product.
- `src/kaixusuperideia-layout.css` applies KaixuSuperIDEia-specific styling on top of the shared shell.