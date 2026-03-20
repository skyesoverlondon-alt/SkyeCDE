# SkyDex4 UI rebuild · files pane separation

This rebuild separates the repo browser from the workspace state pane.

## What changed
- Files are now in their own detachable/minimizable pane.
- Workspace is now just project name, save state, diff, and release context.
- Controls remain separate from View and Actions.
- SkyDex agent runs through 0megaSkyeGate using `KAIXU_APP_TOKEN` and `OMEGA_GATE_URL`.
- SkyDex can be launched in CDE-native mode with `?cde=1` to signal panel-first workspace behavior.
- If the internal gate has not been deployed yet, this wiring is still correct and live calls are expected to fail until deployment plus env setup are complete.

## Deploy
Run from the project root with Netlify CLI:

```bash
npx netlify-cli dev
npx netlify-cli deploy --prod
```


## Gate contract
- Runtime endpoint: `OMEGA_GATE_URL`
- App credential: `KAIXU_APP_TOKEN`
- Model alias lane used by SkyDex backend: `kaixu/deep` by default (override with `KAIXU_AGENT_MODEL` when needed)
- Request lane: `/api/ai-agent` -> `0megaSkyeGate /v1/chat`

## Gate note
A `401` from `/api/ai-agent` means 0megaSkyeGate rejected the configured app token. That is a gate auth/config issue.

If the internal gate is not deployed yet, other failures are expected predeploy behavior. The code path should still remain gate-wired so final cutover is only:

1. deploy /workspaces/SkyeCDE/Skye0s-s0l26/Sky0s-Platforms/0megaSkyeGate/0megaSkyeGate-The-Actual-Gate
2. set `KAIXU_APP_TOKEN`
3. set `OMEGA_GATE_URL` if the runtime URL differs from the default
