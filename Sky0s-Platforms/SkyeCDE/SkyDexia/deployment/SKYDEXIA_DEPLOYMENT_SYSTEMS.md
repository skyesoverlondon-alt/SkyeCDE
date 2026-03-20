# SkyDexia Deployment Systems Guide

This file defines the lane-owned deployment contract for SkyDexia.

## 1. Product boundary
- SkyDex is the preserved product surface.
- SkyDexia is the governed upgrade lane.
- SkyDexia must never overwrite the identity of the original SkyDex surface.

## 2. Lane runtime contract
- Lane root: `Sky0s-Platforms/SkyeCDE/SkyDexia`
- Primary runtime command: `python3 -m http.server 4186`
- Primary runtime port: `4186`
- Primary runtime launch URL: `http://127.0.0.1:4186`
- Local package script aliases: `npm run dev`, `npm start`, `npm run serve`

## 3. Launcher bridge dependencies
SkyDexia relies on the SkyeCDE launcher bridge for live lane operations.

Required endpoints:
- `/launcher/skycde/workspace`
- `/launcher/skycde/file`
- `/launcher/skycde/file/rename`
- `/launcher/skycde/file/move`
- `/launcher/skycde/file/delete`
- `/launcher/skycde/directory`
- `/launcher/skycde/terminal/start`
- `/launcher/skycde/terminal/status`
- `/launcher/skycde/terminal/logs`
- `/launcher/skycde/terminal/restart`
- `/launcher/skycde/terminal/stop`

If those endpoints are absent, SkyDexia can still render statically, but workspace, file, runtime, and evidence flows are not production-real.

## 4. Required local environment assumptions
- `python3` must be available for the lane runtime.
- The repo path must preserve `Sky0s-Platforms/SkyeCDE/SkyDexia`.
- A browser must be able to reach `127.0.0.1:4186`.
- The launcher bridge must be reachable from the page origin when using live lane controls.

## 5. Required evidence for release
- Release brief
- Smoke report
- Rollout plan
- Environment audit
- Release handoff
- Runtime log capture
- Preserved-product launch proof

## 6. Deployment reality check
SkyDexia should only be treated as release-ready when all of the following are true:
- the primary runtime starts from inside the lane
- runtime logs can be loaded from inside the lane
- the preserved SkyDex launch path still opens correctly
- the deployment guide matches the actual launcher bridge behavior
- the release handoff file can be generated from the lane

## 7. Promotion sequence
1. Open the SkyDexia release and ops workspace scope.
2. Load this deployment guide and confirm assumptions are still true.
3. Generate the environment audit.
4. Generate the rollout plan.
5. Start the SkyDexia runtime.
6. Capture smoke and runtime evidence.
7. Generate the release handoff.

## 8. Rollback discipline
Rollback should be preferred when any of the following occur:
- launcher bridge endpoints are unavailable
- SkyDex continuity breaks
- runtime logs cannot be captured from the lane
- rollout assumptions no longer match the deployed lane reality