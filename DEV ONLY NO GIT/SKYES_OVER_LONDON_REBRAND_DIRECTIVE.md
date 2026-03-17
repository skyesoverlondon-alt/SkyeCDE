# Skyes Over London Full Rebrand Directive

Complete the rebrand across the entire repository with no partial pass.

## Goal
Replace all active and vendored Eclipse Theia / Theia IDE branding, logos, names, splash assets, preload assets, package metadata, launcher text, updater text, desktop metadata, installer metadata, and visible strings with **Skyes Over London** branding and the PNG logo at:

`/workspaces/SkyeCDE/DEV ONLY NO GIT/SKYESOVERLONDONDIETYLOGO.png`

## Hard Requirements
1. Remove all remaining Theia branding everywhere in the repository, including vendor folders.
2. Replace all Theia logos with the provided PNG.
3. Logo treatment must be floating, pulsing, and have no boxed or container background.
4. Global visual theme must be royal neon gold and purple.
5. Replace **Theia**, **Theia IDE**, **Eclipse Theia**, and legacy product names with **Skyes Over London** or **Skyes Over London Next** where appropriate.
6. Update browser, electron, next, launcher, updater, splash, preload, about, welcome, desktop entry, installer, and package metadata surfaces.
7. Rebuild affected artifacts so generated outputs reflect the new branding.
8. Validate that the browser app starts and visible UI surfaces show the new branding.
9. Commit all changes once complete.

## Required Scope
Must edit all relevant files under:
- `applications/**`
- `theia-extensions/**`
- `scripts/**`
- generated outputs required for the app to actually display the new branding
- vendor tree under `Sky0s-Platforms/**`

## Do Not
- Do not leave vendor branding untouched.
- Do not stop after editing only source files.
- Do not leave splash, preload, logo, or icon assets on old branding.
- Do not leave `package.json`, `electron-builder.yml`, or desktop metadata on old names.
- Do not leave updater, launcher, help, about, or welcome strings on old names.
- Do not give a partial summary in place of completing the full pass.

## Specific Tasks
### 1. Branding Strings
Replace all user-facing instances of:
- Theia
- Theia IDE
- Eclipse Theia
- Theia IDE Next
- old product names still visible in the app

With:
- Skyes Over London
- Skyes Over London Next

Where preview/next channel naming is appropriate.

### 2. Logo and Asset Replacement
Use this exact asset everywhere user-facing:
- `/workspaces/SkyeCDE/DEV ONLY NO GIT/SKYESOVERLONDONDIETYLOGO.png`

Replace:
- welcome logos
- about logos
- splash logos
- preload logos
- launcher logos
- desktop and installer icons where applicable
- CSS-driven brand marks
- vendor product logos where they still surface visually

### 3. Visual Theme
Apply a consistent royal neon look:
- dark luxury background
- neon purple glow
- gold highlights
- floating pulsing logo treatment
- no boxed logo plate
- no old cyan/Theia visual identity unless absolutely required for non-user-facing internals

### 4. Product Metadata
Update all user-facing metadata in:
- `package.json`
- `electron-builder.yml`
- preload templates
- splash assets
- launcher desktop entries
- updater labels
- help/about/documentation menu labels where branded names appear

### 5. Vendor Sweep
Perform the same replacement inside vendored product code under:
- `Sky0s-Platforms/**`

This is mandatory. Do not skip vendor code.

### 6. Rebuild and Validation
After edits:
- rebuild product extensions
- rebuild browser/electron artifacts as needed
- confirm generated outputs reflect new branding
- start the browser app and validate visible surfaces

## Acceptance Criteria
- Searching the repository for user-facing **Theia IDE** or **Eclipse Theia** returns no remaining active branding hits except unavoidable third-party internals that are not displayed to users.
- All visible app surfaces use the provided PNG logo.
- Welcome, About, splash, preload, launcher, updater, browser, electron, and next builds show **Skyes Over London** branding.
- Theme is visibly royal neon gold and purple.
- Changes are built, validated, and committed.

## Required Final Report
The final report must include:
1. Every file changed.
2. Which branding strings were removed.
3. Which assets were replaced.
4. What was rebuilt.
5. Validation results.
6. Commit hash.
