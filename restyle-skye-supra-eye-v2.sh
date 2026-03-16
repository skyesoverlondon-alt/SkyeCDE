#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

CANDIDATES=(
  "src/styles.css"
  "src/index.css"
  "src/app.css"
  "app/globals.css"
  "styles.css"
  "public/styles.css"
  "public/assets/platform.css"
)

TARGET=""
for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ]; then
    TARGET="$c"
    break
  fi
done

if [ -z "$TARGET" ]; then
  mkdir -p src
  TARGET="src/styles.css"
  touch "$TARGET"
fi

THEME_DIR="$(dirname "$TARGET")"
THEME_FILE="$THEME_DIR/skye-supra-eye-v2.css"
BACKUP_DIR=".skye-theme-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$TARGET" "$BACKUP_DIR/$(basename "$TARGET")"

cat > "$THEME_FILE" <<'CSS'
@import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;700&family=Playfair+Display:wght@600;700&display=swap");

:root {
  color-scheme: dark;
  --skye-bg-0: #06040d;
  --skye-bg-1: #130a20;
  --skye-bg-2: #241239;
  --skye-bg-3: #020509;
  --skye-glass: rgba(18, 11, 30, 0.82);
  --skye-glass-strong: rgba(12, 8, 22, 0.96);
  --skye-border: rgba(168, 106, 255, 0.36);
  --skye-border-soft: rgba(222, 196, 255, 0.24);
  --skye-gold: #ffd660;
  --skye-purple: #a243ff;
  --skye-violet: #8a4fff;
  --skye-cyan: #27f2ff;
  --skye-teal: #7f40ff;
  --skye-text: #faf4ff;
  --skye-muted: #c7b8e5;
  --skye-shadow: 0 24px 72px rgba(0, 0, 0, 0.42);
  --skye-glow: 0 0 28px rgba(168, 106, 255, 0.24);
  --skye-font-body: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
  --skye-font-display: "Orbitron", "Playfair Display", serif;
  --skye-font-mono: "IBM Plex Mono", ui-monospace, monospace;
}

*,
*::before,
*::after { box-sizing: border-box; }

html, body, #root { min-height: 100%; }

html, body {
  margin: 0;
  color: var(--skye-text);
  font-family: var(--skye-font-body);
  background:
    radial-gradient(circle at 10% 12%, rgba(168, 106, 255, 0.18), transparent 36%),
    radial-gradient(circle at 88% 14%, rgba(255, 214, 96, 0.14), transparent 40%),
    radial-gradient(circle at 58% 88%, rgba(127, 64, 255, 0.14), transparent 44%),
    linear-gradient(158deg, var(--skye-bg-0), var(--skye-bg-1) 52%, var(--skye-bg-3));
  background-attachment: fixed;
  overflow-x: hidden;
}

body::before {
  content: "";
  position: fixed;
  inset: -40% -20%;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(168, 106, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(168, 106, 255, 0.07) 1px, transparent 1px);
  background-size: 46px 46px;
  transform: perspective(900px) rotateX(72deg) translateY(-220px);
  animation: skye-atmo-drift 32s linear infinite;
  opacity: 0.32;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(circle at 8% 16%, rgba(168, 106, 255, 0.22), transparent 24%),
    radial-gradient(circle at 90% 84%, rgba(255, 214, 96, 0.16), transparent 28%);
  filter: blur(24px);
}

@keyframes skye-atmo-drift {
  0% { transform: perspective(900px) rotateX(72deg) translateY(-220px) translateX(0); }
  50% { transform: perspective(900px) rotateX(72deg) translateY(220px) translateX(18px); }
  100% { transform: perspective(900px) rotateX(72deg) translateY(-220px) translateX(0); }
}

a { color: inherit; }

h1, h2, h3, h4, .brand, .app-title, .platform-brand, .shell-title {
  font-family: var(--skye-font-display);
  letter-spacing: 0.04em;
  color: #fff;
  text-shadow: 0 0 24px rgba(168, 106, 255, 0.32);
}

p, small, label, .muted, .app-subtitle, .platform-note, .entry-meta, .section-header small, .panel-kicker {
  color: var(--skye-muted);
}

button, input, textarea, select {
  font: inherit;
  color: var(--skye-text);
}

button,
.button,
.platform-button,
.button-link,
.action-btn,
.preview-tab,
.rail-btn,
.tabDockBtn {
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: var(--skye-text);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

button:hover,
.button:hover,
.platform-button:hover,
.button-link:hover,
.action-btn:hover,
.preview-tab:hover,
.rail-btn:hover,
.tabDockBtn:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 214, 96, 0.42);
  box-shadow: 0 0 18px rgba(255, 214, 96, 0.16);
}

button.primary,
.button.primary,
.platform-button:not(.ghost),
.button-link:not(.secondary),
.preview-tab.active,
.rail-btn.active {
  background: linear-gradient(135deg, rgba(138, 79, 255, 0.94), rgba(255, 214, 96, 0.82));
  color: #120d1f;
  font-weight: 700;
  border-color: rgba(255, 214, 96, 0.28);
}

input, textarea, select {
  background: rgba(10, 8, 18, 0.76);
  border: 1px solid var(--skye-border);
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 2px solid rgba(255, 214, 96, 0.92);
  outline-offset: 2px;
}

.ide-shell,
.workbench-shell,
.platform-shell,
.shell,
.theia-ApplicationShell,
.monaco-workbench {
  position: relative;
  z-index: 1;
  background: transparent !important;
  color: var(--skye-text);
}

.topbar,
.platform-topbar,
.panel,
.platform-panel,
.hero-panel,
.card,
.surface-card,
.utility-card,
.sidebar-panel,
.preview-pane,
.editor-pane,
.mini-card,
.metric-card,
.list-entry,
.tool-card,
.status,
.console-wrapper {
  border: 1px solid var(--skye-border) !important;
  background: linear-gradient(180deg, rgba(20, 17, 36, 0.94), rgba(11, 9, 20, 0.94)) !important;
  box-shadow: var(--skye-shadow);
  backdrop-filter: blur(14px);
}

.topbar,
.platform-topbar { border-radius: 22px; }

.panel,
.platform-panel,
.hero-panel,
.card,
.surface-card,
.utility-card,
.sidebar-panel,
.preview-pane,
.editor-pane,
.mini-card,
.metric-card,
.list-entry,
.tool-card,
.status,
.console-wrapper { border-radius: 18px; }

.activity-rail,
.sidebar,
.sidebar-panel,
.left-panel,
.nav-shell {
  background: linear-gradient(180deg, rgba(13, 17, 25, 0.95), rgba(17, 22, 34, 0.98)) !important;
  border-color: rgba(168, 106, 255, 0.22) !important;
}

.statusbar,
.footer-bar,
.bottom-bar {
  background: linear-gradient(90deg, rgba(91, 58, 168, 0.92), rgba(53, 73, 145, 0.92)) !important;
  color: #fff !important;
}

.monaco-editor,
.monaco-editor-background,
.monaco-workbench .part.editor > .content,
.editor-layout,
.editor-stack,
.console-wrapper {
  background: rgba(7, 8, 14, 0.74) !important;
}

::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(138,79,255,0.75), rgba(255,214,96,0.65));
  border-radius: 999px;
  border: 2px solid rgba(7,8,14,0.5);
}
CSS

IMPORT_LINE="@import \"./$(basename "$THEME_FILE")\";"
if ! grep -q "skye-supra-eye-v2.css" "$TARGET"; then
  {
    printf '%s\n' "$IMPORT_LINE"
    cat "$TARGET"
  } > "$TARGET.tmp"
  mv "$TARGET.tmp" "$TARGET"
fi

echo "Done."
echo "Theme file: $THEME_FILE"
echo "Injected into: $TARGET"
echo "Backup saved in: $BACKUP_DIR"
