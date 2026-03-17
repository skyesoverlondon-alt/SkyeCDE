# ChromeBoard

ChromeBoard is a static installable PWA that turns a Chromebook into a semi-home-screen launcher for files, folders, app links, dashboards, and imported browser surfaces.

## What changed in this build

- Renamed the shell to **ChromeBoard**.
- Added a real **import bridge** for browser pages and links.
- Added **clipboard URL import**.
- Added a **Web Share Target** manifest entry so the installed app can receive shared links.
- Included a **ChromeBoard Import Helper** extension for right-click import from Chrome pages, links, images, video, and audio.

## Deploy

Deploy the `chromeboard` folder as a static site on Netlify, Cloudflare Pages, or another HTTPS host.

## Install the app

Open the deployed site in Chrome on Chromebook and install the PWA.

## Use the import helper extension

Inside this bundle there is a folder named `chromeboard-import-helper-extension`.

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select the `chromeboard-import-helper-extension` folder
5. Open the extension **Options** page
6. Paste your deployed ChromeBoard URL

After that, right-click pages or links in Chrome and choose **Import to ChromeBoard**.

## Reality check

The normal web stack can use file pickers, share targets, and browser context menus. It cannot inject a custom right-click item into the native ChromeOS launcher itself. So this build uses the real loophole path: installed PWA + browser helper extension + file/folder handles + share import.


## Easier onboarding upgrade

This build adds a faster setup flow:
- Quick Setup dialog on first launch
- Scan Folder: import top-level files/subfolders from Downloads, Linux files, or another chosen folder
- Bulk Link Import: paste one URL per line or `name | url | icon | tags`
- Upgraded helper extension: import current tab, all tabs in current window, all open tabs, or bookmark bar in one shot

ChromeOS still does not expose native launcher pin scraping to ordinary web apps/extensions, so ChromeBoard bridges with the closest real surfaces: folders, tabs, bookmarks, clipboard, and right-click browser imports.
