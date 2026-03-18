## Signing And Bundle Audit

This note separates packaging-sensitive identifiers from the safe rebrand pass.

### Do Not Rename Without A Packaging Migration

- `applications/electron/scripts/sign-directory.ts`: contains `eclipse.theia` signing identifiers.
- `applications/electron/scripts/sign.sh`: contains `genie.theia@projects-storage.eclipse.org` and Eclipse-hosted signing flow details.
- `applications/electron/scripts/notarize.sh`: contains Eclipse-hosted notarization endpoints and account wiring.
- `applications/electron/electron-builder.yml`: contains bundle and update-channel metadata that can affect notarization, app identity, and auto-update continuity.
- `applications/electron-next/electron-builder.yml`: same risk profile for the next channel.

### Review Before Changing

- `THEIA_CONFIG_DIR` and `THEIA_DEFAULT_PLUGINS` environment variables in Electron startup scripts.
- `THEIA_IDE_JENKINS_*` CI variables in packaging scripts.
- Any app ID, artifact name, publish path, or update feed value consumed by Electron Builder or release automation.

### Safe Rebrand Completed Separately

- User-facing docs and resource labels.
- Authored package names and extension dependency names.
- Product and updater module filenames, imports, and command IDs.
- Electron main script filenames and local debug launch references.