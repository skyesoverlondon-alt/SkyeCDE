# SkaixuPro-IDE Health

Path: Sky0s-Platforms/SkaixuPro-IDE/
Status: WARN
Gateway role: Large multi-module IDE and tool platform

Inventory snapshot:
- SkaixuPro-IDE-Platform active modules
- skaixuidepro-marketing-site
- empty SkaixuPro-IDE-Website placeholder

Current state:
- Large module inventory is present and should be treated as multiple app surfaces
- Many modules already use the unified gateway URL pattern

Known risks:
- Historical security issue around KAIXU_VIRTUAL_KEY still requires operational rotation discipline
- Localhost hardcodes and duplicate/orphan module versions still need cleanup
- SkyeVault remains an explicitly legacy cloud-stack-oriented tool and is out of step with the current direction

Next actions:
- Keep removing localhost production fallbacks
- Retire deprecated module copies
- Decide whether SkyeVault is migrated, replaced, or archived