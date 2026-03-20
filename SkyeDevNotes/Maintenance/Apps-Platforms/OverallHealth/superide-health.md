# SuperIDE Health

Path: Sky0s-Platforms/SuperIDE/
Status: WARN
Gateway role: Full-stack IDE with embedded app surfaces

Inventory snapshot:
- apps/skye-ide main IDE bundle
- src frontend shell
- netlify/functions backend
- worker runtime support
- embedded public surfaces including Neural-Space-Pro, SKNore, SkyeBlog,
  SkyeDocxPro, SkyeVault-Pro-v4.46, SovereignVariables, SkyDex4.6 and other S0L26-0s apps

Current state:
- Core SuperIDE fallback wiring and launch-checklist guidance were already corrected to point at 0megaSkyeGate
- This remains one of the heaviest and messiest platform trees in the repo

Known risks:
- Legacy navigation links and embedded historical surfaces still need cleanup
- Some public embedded apps still carry old assumptions or unrelated runtime baggage
- Operational correctness still depends on deployed KAIXU_GATEWAY_ENDPOINT and KAIXU_APP_TOKEN settings

Next actions:
- Continue legacy-link cleanup in public surfaces
- Audit worker/src/index.ts and recover-account deployment status
- Keep embedded sub-app inventory synchronized with the catalog