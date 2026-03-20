# ChromeBoard Managed Seed Edition

ChromeBoard is a static installable PWA that turns a Chromebook into a semi-home-screen launcher for files, folders, app links, dashboards, and imported browser surfaces.

## What this upgrade adds

- Keeps the existing ChromeBoard app working.
- Replaces the helper with **ChromeBoard Managed Bootstrap**.
- Adds enterprise-managed seeding through `chrome.storage.managed`.
- Adds one-click **Full bootstrap** from:
  - managed seed items
  - installed Chrome-visible apps
  - bookmark bar
  - open tabs
- Adds optional **auto-bootstrap on startup** for managed devices.
- Includes policy example files.

## Folder map

- `chromeboard-managed-seed/` = deploy this whole folder as the app bundle, or deploy just the app files if you prefer.
- `chromeboard-managed-bootstrap-extension/` = load this unpacked in `chrome://extensions`.
- `policy-examples/` = example enterprise policy payloads and notes.

## Deploy the app

Deploy the app as a static site on Netlify, Cloudflare Pages, or another HTTPS host.

## Install the app

Open the deployed site in Chrome on Chromebook and install the PWA.

## Load the managed bootstrap extension

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `chromeboard-managed-bootstrap-extension` folder
5. Open the extension popup or options page
6. Save the ChromeBoard URL unless your admin policy already sets `chromeboardUrl`

## Managed-device lane

If the Chromebook is enterprise-managed, use the provided managed policy keys to seed ChromeBoard from the same admin-controlled app list you want users to get.

That is the real bridge lane here:

- admin policy decides the app estate
- the extension reads the managed seed
- ChromeBoard auto-populates from that seed

## Reality check

This edition still does not pretend to scrape a private native launcher pin list from an unmanaged Chromebook. It uses the real public lanes Chrome exposes: managed extension policy, Chrome-visible installed apps, tabs, bookmarks, and browser context-menu import.


## Web-served helper download

This build includes a downloadable helper extension at `downloads/chromeboard-managed-bootstrap-extension.zip` and a walkthrough page at `helper-extension-setup.html`.

The site also includes a separate tutorial page at `helper-extension-tutorial.html` that explains the extension workflow, which URL to use, and what each action actually does.
