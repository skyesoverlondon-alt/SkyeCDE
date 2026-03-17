# Home File Board

ChromeOS workaround for a file "home screen".

## What it is
ChromeOS does **not** let you place file or app shortcuts directly on the wallpaper/background desktop.
This app works around that by becoming an installable PWA that acts like your own file launcher board.

## What it does
- Add local files with the File System Access API
- Add folders
- Add Google Drive or web links
- Install as an app on Chromebook
- Use it like a fake home screen for your files

## Important
Local file access requires:
- Chrome / Chromium browser
- Secure context (HTTPS or localhost)
- User gesture when selecting files/folders

## Fast deploy
### Netlify / Cloudflare Pages
Deploy the folder as a static site.

### Local Linux server on Chromebook
If Linux is enabled:
```bash
cd chromebook-home-file-board
python3 -m http.server 8080
```
Then open `http://localhost:8080` in Chrome.

## Install on Chromebook
1. Open the deployed site in Chrome.
2. Use Chrome's install prompt or the in-app Install button.
3. Pin the installed app where you want.
4. Open the app and add your files.

## Limitation
File handles are security-scoped. If permissions expire, the app will ask again when you open a file.
