# SKYDEXIA 2.6 LAUNCHER INTEGRATION DIRECTIVE

## Truth First

SkyDexia 2.6 is the lane that has the verified Codespaces-class autonomous package work in this repo.

The current launcher story is not fully truthful yet because several 0s and SkyeCDE launch surfaces still point to the older SkyDexia lane at `Sky0s-Platforms/SkyeCDE/SkyDexia/` instead of the verified lane at `Sky0s-Platforms/SkyeCDE/SkyDexia-2.6/`.

That means the answer to "is the whole launcher system already aligned to the real SkyDexia" is:

- No, not yet.
- SkyDexia 2.6 exists and verifies as the strongest autonomous lane.
- The launch system still needs to normalize its targets so users actually land in the real lane.

## Scope

This directive is only about launcher and registry integration.

It is not permission to reopen SkyDexia feature work or redesign her product behavior.

The goal is:

1. make SkyDexia 2.6 the canonical launch target
2. expose that target from the SkyeCDE hub
3. expose that target from the main 0s launcher registry
4. expose that target from cross-lane launch maps and runtime recipes
5. document any remaining gaps honestly

## Required file edits

### 1. SkyeCDE hub routing

File: `Sky0s-Platforms/SkyeCDE/skyecde-manifest.json`

Required work:

- change the SkyDexia `href` from `./SkyDexia/index.html` to `./SkyDexia-2.6/index.html`
- keep the original SkyDex product source reference intact
- update the summary so it reflects the 2.6 autonomous package truth instead of the older generic wrapper description

File: `Sky0s-Platforms/SkyeCDE/index.html`

Required work:

- change the SkyDexia button to open `./SkyDexia-2.6/index.html`
- update the card copy so it says this is the verified autonomous package lane, not just a generic upgrade shell

### 2. Shared cross-lane launch routing

File: `Sky0s-Platforms/SkyeCDE/_shared/skyehawk-routes.js`

Required work:

- point the shared SkyDexia route at `../SkyDexia-2.6/index.html`
- update the description so it explicitly calls this the verified autonomous lane

Files:

- `Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/src/skaixuproideia-launch-map.js`
- `Sky0s-Platforms/SkyeCDE/SuperIDEia/src/superideia-launch-map.js`
- `Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-launch-map.js`

Required work:

- point every `skydexia` target at `../SkyDexia-2.6/index.html`

### 3. Cross-lane runtime launch recipes

Files:

- `Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/src/skaixuproideia-terminal-actions.js`
- `Sky0s-Platforms/SkyeCDE/SuperIDEia/src/superideia-terminal-actions.js`
- `Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-terminal-actions.js`

Required work:

- change the SkyDexia comparison runtime `cwd` from `Sky0s-Platforms/SkyeCDE/SkyDexia` to `Sky0s-Platforms/SkyeCDE/SkyDexia-2.6`
- preserve the existing simple static-server comparison behavior unless there is a verified reason to replace it

### 4. Main 0s launcher registry

File: `theia-extensions/product/src/browser/generated/skye-generated-catalog.ts`

Required work:

- change the SkyDexia registry `href` to the 2.6 lane
- change the `inventoryPath` to `Sky0s-Platforms/SkyeCDE/SkyDexia-2.6/`
- update the summary so the launcher tells the truth about this lane being the verified autonomous package

File: `SkyeDevNotes/Maintenance/Apps-Platforms/Catalog`

Required work:

- update the SkyeCDE catalog description so the human-readable registry notes mention `SkyDexia-2.6/` as the active canonical SkyDexia lane
- stop describing `SkyDexia/` alone as the launcher target

## Follow-through rules

- Do not silently leave old launcher routes behind if they claim to open SkyDexia.
- Do not claim the launcher work is done until the hub, shared routes, cross-lane launch maps, runtime recipes, and generated 0s catalog all point at the same lane.
- If any other surface still intentionally points at the older `SkyDexia/` wrapper, that must be called out as a deliberate exception.

## Current completion standard

This directive is complete for the first pass when:

- SkyeCDE hub opens SkyDexia 2.6
- cross-lane launch buttons open SkyDexia 2.6
- cross-lane runtime recipes boot from the SkyDexia 2.6 folder
- the main 0s launcher catalog launches SkyDexia 2.6
- the remaining difference between `SkyDexia/` and `SkyDexia-2.6/` is documented honestly instead of hidden