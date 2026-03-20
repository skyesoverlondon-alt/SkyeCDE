# SkyDexia Runtime Runbook

## Purpose
Use this runbook when the SkyDexia lane runtime fails, hangs, or returns incomplete proof.

## Triage order
1. Refresh runtimes from inside SkyDexia.
2. Select the active runtime id.
3. Load logs.
4. Confirm whether the launch URL is still reachable.
5. Restart the runtime if recovery is safe.

## Minimum evidence to capture
- runtime id
- launch URL
- stdout excerpt
- stderr excerpt
- exact reproduction path
- whether current SkyDex still opens correctly

## Recovery actions
1. Restart the runtime once from inside the lane.
2. Re-load logs immediately after restart.
3. Re-open the live runtime surface.
4. If the issue persists, generate the incident log and stop promotion work.

## Escalation conditions
Escalate when:
- the runtime fails twice in a row
- logs do not load through the bridge
- preserved SkyDex continuity also regresses
- the lane can no longer generate its own evidence files

## Required follow-up files
- dated incident log
- dated smoke report
- dated release handoff