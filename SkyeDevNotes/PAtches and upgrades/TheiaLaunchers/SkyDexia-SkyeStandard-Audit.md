# SkyDexia Skye Standard Audit

## Scope

This audit scores SkyDexia against the current repo-wide Skye Standard.

This is SkyDexia-only.
It does not grade the other IDEias.

It uses the current evidence from:

- SkyDexia lane files and runbooks
- the shared IDEia shell renderer and CSS
- the original SkyDex product surface
- the rewritten Skye Standard

## Scoring Model

- 10 domains
- 10 points each
- 100 points total
- 85+ means SkyDexia is operating at Skye Standard
- 70-84 means strong progress but not there yet
- below 70 means the lane is still structurally under standard

## Current Score

SkyDexia currently scores **82 / 100**.

That means SkyDexia is materially closer to Skye Standard, but it is not fully there yet.

The lane already has real governance, release, and runbook structure.
What it does not yet have is a complete SkyDex-first operating package that cleanly exposes the wider Skye stack without turning into one overloaded page.

## Scorecard

| Domain | Score | Result | Current truth |
| --- | ---: | --- | --- |
| Product identity preservation | 9 / 10 | Pass | SkyDex is still treated as the product authority and SkyDexia is framed as the governed upgrade lane. |
| Full-app launch discipline | 9 / 10 | Pass | SkyDexia now exposes full-app launch surfaces from a dedicated launch page and keeps preview-widget behavior out of the lane contract. |
| Workspace, file, and runtime bridge | 8 / 10 | Pass | SkyDexia now carries dedicated workspace and runtime pages with live bridge-backed controls, file editing, runtime control, and persistent operator state. |
| Release governance and ops discipline | 8 / 10 | Pass | Deployment guide, runtime runbook, release command center, validation checks, artifacts, and release gates already exist. |
| Proof, verification, and executable readiness | 8 / 10 | Pass | Validation, workflow, artifact, release handoff, preflight, and rollback packet surfaces are now first-class pages, though the promotion path still needs deeper runtime-linked proof. |
| Ecosystem wiring across Skye stack | 7 / 10 | Pass | SkyDexia now exposes first-class cloud, mail, identity, and sovereign operating pages with repo-backed quick actions and posture capture, though some controls are still posture-first rather than live API automation. |
| Sovereign primitives and policy integration | 7 / 10 | Pass | SkyDexia now has a dedicated sovereign page that centers gate, policy, variables, and .skye posture instead of leaving them implied. |
| Data, storage, mail, and identity operating lanes | 7 / 10 | Pass | Dedicated Mail + Identity and GitHub + Cloud pages now exist, including posture forms and lane-owned generated briefs for these domains. |
| UI architecture and control-surface discipline | 9 / 10 | Pass | SkyDexia now runs as a dedicated multi-page package and every section in the shell is scrollable, collapsible, and minimizable. |
| Deployment bootstrap and promotion automation | 8 / 10 | Pass | SkyDexia now exposes dedicated operating pages, generated briefs, recovery desks, and rollback packet flows for promotion posture, but deeper live GitHub, Netlify, and Cloudflare execution still needs to be wired. |

## What SkyDexia Already Gets Right

- SkyDex is still the product identity.
- SkyDexia is not being treated as a rename of SkyDex.
- The lane already owns deployment, runtime, and release documents.
- The enterprise profile already includes checks, artifacts, gates, runbooks, and verification matrix structure.
- Full-app launch behavior is already part of the intended contract.

## What Is Holding The Score Down

- SkyDexia still leans too hard on a shared one-page shell.
- The original SkyDex surface already owns more real operating controls than the current SkyDexia wrapper exposes.
- The broader Skye Standard stack is not yet reflected in dedicated SkyDexia pages for cloud, data, mail, identity, and sovereign operations.
- Menu behavior is not yet standardized so every menu is scrollable, collapsible, and minimizable.
- The lane has governance docs, but not enough live first-class operating consoles to prove Skye Standard end to end.

## Critical Audit Checklist

### Passing now

- [x] SkyDex remains the product authority.
- [x] SkyDexia is framed as an upgrade lane, not a forced replacement.
- [x] Full app launch behavior is part of the lane contract.
- [x] Deployment guidance exists.
- [x] Runtime runbook exists.
- [x] Release command center exists.
- [x] Validation checks, release gates, risks, and verification matrix exist.

### Not passing yet

- [x] SkyDexia has a route-level page model instead of one growing shell.
- [x] Every menu in SkyDexia is scrollable.
- [x] Every menu in SkyDexia is collapsible.
- [x] Every menu in SkyDexia is minimizable.
- [ ] SkyDexia cleanly exposes the real SkyDex release controls already present in the original product.
- [x] SkyDexia has a first-class GitHub operating surface.
- [x] SkyDexia has a first-class Netlify operating surface.
- [x] SkyDexia has a first-class Cloudflare operating surface.
- [x] SkyDexia has a first-class data and storage surface covering Neon, R2, and Netlify Blobs.
- [x] SkyDexia has a first-class mail and identity surface covering Gmail-compatible SMTP, Resend fallback, and identity state.
- [x] SkyDexia has a first-class sovereign surface covering 0megaSkyeGate, SKNore, SovereignVariables, and `.skye` handling.
- [ ] SkyDexia can produce release evidence from the same live operating package instead of from docs alone.
- [ ] SkyDexia can validate, ship, and recover from the same visible command structure.
- [ ] SkyDexia can prove the full promotion path to GitHub, Netlify, and Cloudflare from the lane.

## Build Delta

The current implementation materially changed the lane:

- SkyDexia no longer depends on the generic shared one-page shell renderer.
- SkyDexia now boots through a lane-owned renderer with dedicated pages for command, workspace, runtime, launch, delivery, cloud, mail, and sovereign operations.
- Section state is persistent and every section is scrollable, collapsible, and minimizable.
- GitHub and cloud posture, mail and identity posture, and sovereign posture can now generate lane-owned markdown briefs directly into the SkyDexia delivery folder.
- Preflight checks, rollback packet generation, runtime recovery actions, and continuity checks are now exposed directly inside the runtime and delivery pages.
- Browser smoke verified that the new shell loads and that page navigation plus section-collapse state persist in localStorage.

## Architecture Directives

These are mandatory if SkyDexia is going to hit Skye Standard.

### 1. Stop adding more controls to the current one-page shell

Do not keep stuffing new cloud, release, data, and sovereign controls into the shared stacked shell.

That path will make SkyDexia harder to operate, not more complete.

### 2. SkyDexia needs dedicated pages

SkyDexia should become a multi-surface operating package.

Minimum page split:

- Command Center
- Workspace and Files
- Runtime and Logs
- GitHub and Netlify
- Cloudflare and Data
- Mail and Identity
- Sovereign Controls
- Release Evidence

### 3. Every menu must follow one behavior contract

Every menu, drawer, panel, and control group must be:

- scrollable
- collapsible
- minimizable

This applies to every menu.

### 4. SkyDex product authority remains visible

SkyDexia should inherit and elevate the original SkyDex capability, not bury it under generic Theia furniture.

### 5. Theia stays behind the product surface

Theia can power workspace, editor, terminal, process, and extension support.

It should not become the visible product identity.

## Massive To Do List

### Phase 1: Lock the information architecture

1. Freeze the rule that SkyDexia will expand by pages, not by stacking more panels into the existing shell.
2. Define the route map for the minimum eight-page SkyDexia operating package.
3. Decide which current shared-shell sections stay on Command Center and which move into dedicated pages.
4. Add a single menu-behavior contract for scroll, collapse, and minimize states.
5. Make the shared renderer support page-level composition instead of assuming one long dashboard.

### Phase 2: Bring forward the real SkyDex operating surface

6. Audit the original SkyDex controls and list which product-grade actions already exist there.
7. Promote the existing SkyDex bounded-agent, SKNore, GitHub, Netlify, and workspace-release controls into SkyDexia-owned page architecture.
8. Keep SkyDex branding, copy, and operator flow intact while moving support tooling behind cleaner surfaces.
9. Ensure every promoted action still runs against the same authoritative workspace snapshot.
10. Ensure no promoted action regresses into preview-widget behavior.

### Phase 3: Build the missing Skye Standard consoles

11. Add a GitHub page for connect, branch, commit, push, and proof state.
12. Add a Netlify page for site connect, deploy, deploy history, functions state, blobs state, and release evidence.
13. Add a Cloudflare page for worker target, Wrangler state, bindings, deploy health, and edge evidence.
14. Add a Data page for Neon, R2, Netlify Blobs, and any lane-owned persistence checks.
15. Add a Mail and Identity page for SMTP state, Gmail-compatible config posture, Resend fallback posture, and identity/admin state.
16. Add a Sovereign page for 0megaSkyeGate state, SKNore policy truth, SovereignVariables sync, `.skye` package posture, and vault direction.

### Phase 4: Normalize the operator experience

17. Add persistent page navigation so operators can move across the package without losing context.
18. Add per-page status summaries instead of making users scan a giant mixed dashboard.
19. Make every page remember collapse and minimize preferences.
20. Add per-page scroll containers so no menu becomes unusable when content grows.
21. Add a compact mode for dense release and runtime operations.
22. Add a recovery path so operators can always get back to the main Command Center.

### Phase 5: Upgrade proof, validation, and release truth

23. Convert the existing readiness probes into visible pass or fail controls with evidence output.
24. Add release evidence packaging that links validation, deploy state, and rollback posture.
25. Make GitHub, Netlify, and Cloudflare promotion status visible in one release-evidence page.
26. Add proof that runtime logs, validation, and release artifacts all refer to the same lane state.
27. Add rollback and recovery proof flows that map directly to the runtime runbook.

### Phase 6: Finish the Skye Standard contract

28. Add explicit checks for sovereign boundary posture before release.
29. Add explicit checks for data and storage posture before release.
30. Add explicit checks for mail and identity posture before release.
31. Add explicit checks for full-app launch discipline before release.
32. Re-score SkyDexia after every major phase and do not mark it complete until it clears 85 out of 100.

## Immediate Order Of Work

If the goal is to get SkyDexia to standard without wasting time, the order should be:

1. page map
2. shared-shell refactor for multi-page support
3. universal menu behavior contract
4. promotion of existing SkyDex operating controls
5. dedicated GitHub and Netlify pages
6. dedicated Cloudflare and Data page
7. dedicated Mail and Identity page
8. dedicated Sovereign page
9. release-evidence page
10. re-audit and re-score

## Bottom Line

SkyDexia is not starting from zero.

It already has real release-lane structure.

But right now it is still a governed wrapper around part of the SkyDex operating reality, not the full SkyDex-first Skye Standard package.

To reach your standard, SkyDexia has to stop growing as one increasingly crowded shell and become a disciplined multi-page operating system for the real stack it is supposed to command.