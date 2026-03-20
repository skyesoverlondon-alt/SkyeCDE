# Managed-device seeding notes

This edition is for the lane Chrome actually exposes on enterprise-managed devices.

Use it like this:

1. Deploy the ChromeBoard app.
2. Install this extension on the managed Chromebook.
3. Configure the extension's managed policy values shown in `chromeboard-extension-managed-policy-example.json`.
4. Optionally configure ChromeOS admin policies that force-install or pin apps for users.
5. Keep the same core app URLs in both places:
   - your ChromeOS admin pin/install policy
   - the extension's `seedItems`
6. On browser startup, or when the managed policy changes, the extension can bootstrap ChromeBoard automatically.

Why this exists:

- Chrome exposes enterprise-managed extension settings through `chrome.storage.managed`.
- Chrome exposes Chrome-visible installed apps through `chrome.management.getAll()`.
- Chrome Enterprise admins can force-install apps and pin apps through admin policies.
- Chrome does **not** expose a normal public API that simply dumps the user's private native launcher pin list to a web app or ordinary extension.

So this build mirrors the managed launcher source of truth into ChromeBoard instead of pretending an undocumented pin-scrape API exists.
