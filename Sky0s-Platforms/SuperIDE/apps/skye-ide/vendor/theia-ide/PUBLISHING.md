# Publishing Guide for Skyes Over London

This document describes the repo-owned release flow for Skyes Over London. It replaces the older Eclipse-hosted Theia IDE publishing notes with steps that match this repository's current build and packaging setup.

## 1. Release Preparation

- Confirm branding, product metadata, updater URLs, and launcher schemes match the intended release.
- Verify the target version in the root `package.json` and any Electron packaging metadata that ships in the release.
- Review open release-blocking issues in the SkyeCDE tracker.
- Sync any required wrapper changes into the vendor mirror under `Sky0s-Platforms/SuperIDE/apps/skye-ide/vendor/theia-ide` when the release depends on mirrored product behavior.

## 2. Build and Validate

Install dependencies and produce the production bundles from the repository root:

```sh
yarn
yarn build
yarn download:plugins
```

If you need a lighter validation path while iterating, run:

```sh
yarn build:dev
```

Recommended pre-release validation:

- Run `yarn browser start` and verify the browser target starts cleanly with Skyes Over London branding.
- Run `yarn --cwd applications/electron build:prod` to verify the Electron production bundle completes.
- Run any targeted smoke or regression coverage required for the release.

## 3. Package the Electron Distribution

Create the distributable package from the main Electron app:

```sh
yarn --cwd applications/electron package
```

If you need a preview package instead:

```sh
yarn --cwd applications/electron package:preview
```

Artifacts are written to `applications/electron/dist`.

Before publishing, validate the packaged application:

- Launch the packaged build.
- Verify updater channel behavior and release metadata.
- Check that icons, app name, copyright, and protocol handlers use Skyes Over London branding.

## 4. Publish the Release

- Create or update a GitHub release in `SkyeCDE/SkyeCDE`.
- Upload the packaged artifacts from `applications/electron/dist`.
- Include release notes covering user-visible changes, platform limitations, and known regressions.
- If the release uses preview-first rollout, publish preview notes first and promote the same artifacts after validation.

## 5. Docker and Additional Channels

If the release also includes the browser container image, build it from the repository root:

```sh
docker build -t skyes-over-london:<version> -f browser.Dockerfile .
```

Publish any additional channels only if they are actively maintained for this product. Do not rely on the historical Eclipse-hosted Theia IDE distribution targets unless they have been intentionally repointed for this repository.

## 6. Post-Release

- Tag the release commit.
- Verify the release assets are downloadable from the configured publication destination.
- Update release notes, announcements, and channel metadata that point to the new version.
- Queue dependency upgrades and follow-up fixes in a separate change.
