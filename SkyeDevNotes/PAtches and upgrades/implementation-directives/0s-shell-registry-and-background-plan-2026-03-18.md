# 0s Shell Registry + Background Plan

## What this file is for

This plan covers three linked tracks:

1. Wire the same app registry into Getting Started and About so the shell tells the same 0s-first story everywhere.
2. Define the stronger built-in set for the first real platform/app packaging pass.
3. Upgrade the Theia product shell styling so it behaves like the layered SuperIDE UI: modular glass panels over a dedicated swappable scene layer.

## Non-negotiable product truth

- The 0s is the product.
- Theia is the shell upgrade.
- The launcher, Getting Started, About, and Extensions surfaces must all tell the same story.
- The catalog cannot be treated as a single-platform list. SuperIDE is one platform family that already contains many apps, but it is not the entire 0s.

## Current structured registry sources

- Primary structured app inventory:
  - `/workspaces/SkyeCDE/Skye0s-s0l26/Sky0s-Platforms/SuperIDE/src/data/app-registry.json`
- Additional launch/front-door inventory:
  - `/workspaces/SkyeCDE/Skye0s-s0l26/Sky0s-Platforms/SuperIDE/public/S0L26-0s/hub-registry.json`

## Implementation plan

### Phase 1: Shared registry everywhere in the shell

- Use one shared frontend registry service in the product extension.
- Aggregate both current structured sources instead of stopping at the first JSON file found.
- Drive these surfaces from that same service:
  - Launcher
  - Extensions built-in 0s catalog panel
  - Getting Started
  - About dialog
- Replace generic placeholder cards with actual platform/app registry content.

### Phase 2: Stronger built-in set for the first packaging pass

For the first true built-in platform/app packaging wave, the priority set is:

- Core platforms:
  - SuperIDE
  - Neural Space Pro
  - kAIxU Platform
  - GBP Rescue Suite
  - Contractor Workflow Suite
  - SkyeCloud
- Major app surfaces:
  - SkyeDocxPro
  - SkyeVault Pro
  - SkyeAdmin
- Shell-level control surfaces that must stay easy to reach:
  - Settings menu
  - Admin menu/control surfaces

### Phase 3: Full-catalog normalization

- Keep the full app catalog visible in the shell even before every app is packaged as a true built-in extension unit.
- Stop treating the current SuperIDE registry as if it were the final multi-platform source of truth.
- Create a next registry layer that can merge multiple platform-family registries, not just SuperIDE.
- Add fields for:
  - platform family
  - built-in packaging target
  - launcher visibility
  - extensions visibility
  - admin-only visibility
  - external property vs internal runtime

### Phase 4: Background and shell upgrade

- Use a dedicated scene plane behind the UI, not flat shell background colors.
- Keep workbench and panels as layered glass surfaces over that scene.
- Make the scene swappable through one runtime config hook instead of hard-coding one background forever.
- The initial visual reference should follow the SuperIDE pattern:
  - atmospheric dark base
  - layered modular glass panels
  - visible depth plane behind UI
  - branded motion and ambient glow

## Full current catalog inventory

### Build + IDE

- SkyDex 4.6
- Neural Space Pro
- WebPilePro
- SkyeVault Pro
- REACT2HTML
- SovereignVariables
- SkyeDrive
- SkyeVault
- Smokehouse
- API Playground

### Workspace + Content

- SkyeDocs
- SkyeDocxPro
- SkyeBlog
- SkyeBookx
- SkyeSheets
- SkyeSlides
- SkyeForms
- SkyeNotes

### Platform Systems

- Contractor Workflow Suite
- ContractorNetwork
- Contractor Income Verification
- Contractor Verification Suite
- AE-Flow
- Google Business Profile Rescue
- GBP Rescue Suite

### Communications + Identity

- Recover Account
- SKYEMAIL-GEN
- Skye-ID
- SkyeMail
- SkyeChat
- SkyeCalendar
- SkyeAdmin

### Operations + Executive

- SkyeAnalytics
- SkyeTasks
- Skye Platinum

### kAIxU Creative + Codex

- kAIxU Platform
- kAIxU Suite
- kAIxU-Vision
- kAixu-Nexus
- kAIxU-Codex
- kAIxu-Atmos
- kAIxu-Quest
- kAIxu-Forge
- kAIxu-Atlas
- kAixU-Chronos
- kAIxu-Bestiary
- kAIxu-Mythos
- kAIxU-Matrix
- kAIxu-Persona
- kAIxU-Faction
- kAIxU-PrimeCommand

### Additional launch/front-door entries from hub registry

- SuperIDE
- SkyePDF Forge
- Skye Time Hour Logger
- Sole Contractor Addon
- SkyeCloud
- Mini Ops Suite
- DemonLeadForge

### External properties currently listed in the hub registry

- SkyeSol
- Skyeletix
- Northstar Office X Accounting
- Valley Verified
- SOLE Nexus
- SOLE Enterprises Nexus Connect
- Skye Family Hub
- Sentinel Web Authority
- SOLenteaiSkyes
- Family Command
- SkyeCode Nexus
- Skyes Over London
- SkyeWeb

## Next concrete build steps

1. Keep the aggregated registry service as the source for launcher, Extensions, Getting Started, and About.
2. Add platform-family metadata so the shell can distinguish platform roots from leaf apps.
3. Package the stronger set first: core platforms, SkyeDocxPro, vault-backed launch lane, admin/control surfaces.
4. Keep the full catalog visible in UI even before every entry has true built-in extension packaging.
5. Maintain the background as a swappable dedicated scene layer instead of reverting to flat background paint.