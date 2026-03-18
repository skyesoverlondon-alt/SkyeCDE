<br/>
<div id="theia-logo" align="center">
    <br />
  <img src="theia-extensions/product/src/browser/icons/SKYESOVERLONDONDIETYLOGO.png" alt="Skyes Over London logo" width="300"/>
  <h3>Skyes Over London</h3>
</div>

Skyes Over London is a Theia-based desktop and browser IDE distribution maintained in this repository. The repo also acts as the product wrapper and branding layer for packaging, release engineering, updater behavior, and launcher integration on top of the upstream Theia platform.

For product issues, packaging regressions, or branding changes, use the SkyeCDE repository. For upstream platform behavior that reproduces outside this product wrapper, use the main Theia project.

- Product repository: [SkyeCDE/SkyeCDE](https://github.com/SkyeCDE/SkyeCDE)
- Upstream platform: [eclipse-theia/theia](https://github.com/eclipse-theia/theia)
- Theia documentation: [User docs](https://theia-ide.org/docs/user_getting_started/) and [desktop packaging docs](https://theia-ide.org/docs/blueprint_documentation/)

## License

- [MIT](LICENSE)

## Trademark

"Theia" is a trademark of the Eclipse Foundation.
<https://www.eclipse.org/theia>

## What Is This?

Skyes Over London packages a curated set of Theia extensions, product assets, updater wiring, and Electron/browser application targets into a branded distribution. The codebase keeps the upstream `@theia/*` integration intact while replacing product-facing surfaces with Skyes Over London branding and release metadata.

## Repository Structure

- `applications` contains the browser and Electron targets.
- `theia-extensions/product` contributes product branding and about/welcome UI.
- `theia-extensions/updater` handles update channels and release lookup behavior.
- `theia-extensions/launcher` provides launcher and desktop-entry integration.
- `scripts` contains the direct browser and Electron build helpers used by this repo.

## Development

### Requirements

Follow the upstream Theia prerequisites and keep Node/Yarn versions aligned with the referenced Theia version in this repository.

### Build

Development build:

```sh
yarn && yarn build:dev && yarn download:plugins
```

Production build:

```sh
yarn && yarn build && yarn download:plugins
```

The production build path uses direct webpack entrypoints for the browser and Electron applications to keep resource usage predictable in constrained environments.

### Run the Browser App

```sh
yarn browser start
```

Then open <http://localhost:3000/>.

### Package the Electron App

```sh
yarn package:applications
# or
yarn electron package
```

Artifacts are written to `applications/electron/dist`.

### Preview Package and E2E

```sh
yarn electron package:preview
yarn electron test
```

### Docker

The browser target can also be packaged into a container image:

```sh
docker build -t skyes-over-london -f browser.Dockerfile .
docker run -p=3000:3000 --rm skyes-over-london
```

## Reporting Issues

Open product-layer issues, packaging failures, installer issues, updater regressions, and branding problems in [SkyeCDE/SkyeCDE](https://github.com/SkyeCDE/SkyeCDE/issues). If an issue is clearly in upstream Theia itself, report it in [eclipse-theia/theia](https://github.com/eclipse-theia/theia/issues/new/choose).
