# Theia Startup Files: Source vs Generated (Team Guide)

## Why this feels split into multiple places
In this repo, startup UI is built in layers. That is why you may see the same splash/preload content in more than one location.

There are three layers:
1. Source templates: human-edited files (your real authoring layer).
2. Generated files: auto-created during generation/build prep.
3. Runtime/build output: packaged or served output used at launch.

This is normal for Theia and Electron packaging pipelines. It helps target different app modes (browser and desktop) and keeps build output deterministic.

## Human-level mental model
Think of this as:
- Source = your recipe.
- Generated = prep station output from the recipe.
- Runtime/build = plated dish users actually see.

If you only patch generated/runtime files, your changes can disappear after regeneration.
If you only patch source files, the app may not update until generation/build runs.

## Which files are source templates (edit these first)
These are the primary startup preload templates for each Theia target:

- Browser source template:
  - applications/browser/resources/preload.html
- Electron source template:
  - applications/electron/resources/preload.html
- Electron-next source template:
  - applications/electron-next/resources/preload.html

## Where generated/runtime copies appear
Common places you may see mirrored startup markup/styles:

- Generated frontend HTML:
  - applications/browser/src-gen/frontend/index.html
  - applications/electron/src-gen/frontend/index.html
  - applications/electron-next/src-gen/frontend/index.html

- Runtime/build frontend HTML:
  - applications/browser/lib/frontend/index.html
  - applications/electron-next/lib/frontend/index.html

Note: Electron build output layout can differ from browser. In this workspace, the desktop side may use other build output paths as part of packaging.

## Recommended team workflow (single source of truth)
1. Edit only the source template for the target you intend to change.
2. Regenerate/rebuild so src-gen/lib artifacts are recreated.
3. Validate the launched target (browser, electron, or electron-next).
4. Avoid manual edits in generated/build output unless doing an emergency hotfix.
5. If an emergency hotfix is needed in generated/runtime, backport the same change to source templates immediately.

## Due-diligence checklist for splash/preload changes
- Verify the preload layer and app root background match (prevents white flash).
- Verify preload has hide transition rules (for dissolve handoff).
- Verify the running target (browser/electron/electron-next) reflects the expected CSS.
- Verify source template and generated/runtime copies are in sync after rebuild.

## Quick rule to remember
If you want durable changes, start in resources/preload.html.
If you want immediate effect before rebuild, you might patch generated/runtime too, then backport to source.
