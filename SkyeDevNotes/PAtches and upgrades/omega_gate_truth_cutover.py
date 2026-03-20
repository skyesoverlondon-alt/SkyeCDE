#!/usr/bin/env python3
import os, re, sys, pathlib

ROOT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else pathlib.Path.cwd()
TARGET_URL = sys.argv[2] if len(sys.argv) > 2 else "https://0megaSkyeGate.example"

TEXT_EXTS = {
    '.html','.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.toml','.md','.txt','.py','.yml','.yaml','.env','.css'
}

# literal URL cutovers
URL_REPLACEMENTS = {
    'https://kaixugateway13.netlify.app': TARGET_URL,
    'https://kaixu67.skyesoverlondon.workers.dev': TARGET_URL,
    'https://kaixu67.netlify.app': TARGET_URL,
    'https://kaixu0s.netlify.app': TARGET_URL,
    'https://kaixu0s.skyesoverlondon.workers.dev': TARGET_URL,
}

STRING_REPLACEMENTS = {
    'Kaixu Gate Xnth': '0megaSkyeGate',
    'Gate Xnth': '0megaSkyeGate',
    'Gateway13': '0megaSkyeGate',
    'kAIxuGateway13': '0megaSkyeGate',
    'kaixugateway13': 'omegaskyegate',
    'xnthgateway': 'omegaskyegate',
    'XNTH POSTMORTEM': '0MEGASKYEGATE NORMALIZATION',
}

FILE_PATCHERS = {}

def patch_file(path: pathlib.Path, text: str) -> str:
    orig = text
    for old, new in URL_REPLACEMENTS.items():
        text = text.replace(old, new)
    for old, new in STRING_REPLACEMENTS.items():
        text = text.replace(old, new)

    rel = str(path.relative_to(ROOT)).replace('\\','/')

    # Special patches
    if rel.endswith('Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform/netlify/functions/gateway-chat.js'):
        text = re.sub(r"const\s+UPSTREAM\s*=\s*['\"][^'\"]+['\"];", "const UPSTREAM = (process.env.OMEGA_GATE_URL || '%s') + '/.netlify/functions/gateway-chat';" % TARGET_URL, text)
    if rel.endswith('Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform/netlify/functions/gateway-stream.js'):
        text = re.sub(r"const\s+UPSTREAM\s*=\s*['\"][^'\"]+['\"];", "const UPSTREAM = (process.env.OMEGA_GATE_URL || '%s') + '/.netlify/functions/gateway-stream';" % TARGET_URL, text)
    if rel.endswith('Sky0s-Platforms/SkyErrors/kAIxU-Brain/wrangler.toml'):
        text = re.sub(r'KAIXU_BRAIN_DEFAULT_TARGET\s*=\s*"[^"]+"', 'KAIXU_BRAIN_DEFAULT_TARGET = "omega"', text)
        text = re.sub(r'KAIXU_BRAIN_BASE_KAIXU67\s*=\s*"[^"]+"', 'KAIXU_BRAIN_BASE_KAIXU67 = "%s"' % TARGET_URL, text)
    if rel.endswith('Sky0s-Platforms/SkyErrors/kAIxU-Brain/README.md'):
        text = text.replace('kaixu67|kaixu0s|flow32', 'omega|flow32')
        text = text.replace('kaixu67`, Delta Gate', 'omega`, 0megaSkyeGate')
    if rel.endswith('Sky0s-Platforms/Kaixu67/netlify.toml'):
        # stamp a note only
        if 'OMEGA_GATE_TRUTH' not in text:
            text = '; OMEGA_GATE_TRUTH: legacy Kaixu67 surface retained, upstream truth normalized externally\n' + text

    # Replace frontend constants pointing to literal gates with a local truth expression when obvious
    text = re.sub(
        r"const\s+(GATE|API|API_BASE|GW|GW_URL|KAIXU_GATEWAY_FALLBACK|GATEWAY_DIRECT|KAIXU_GATEWAY_PRIMARY)\s*=\s*['\"]%s['\"]" % re.escape(TARGET_URL),
        lambda m: f"const {m.group(1)} = (window.OMEGA_GATE_URL || localStorage.getItem('OMEGA_GATE_URL') || '{TARGET_URL}')",
        text
    )
    # broader: local/prod ternaries with target URL now resolve to same truth string
    text = re.sub(
        r"(const\s+(?:GATE|API|API_BASE|GW|GW_URL|KAIXU_GATEWAY_FALLBACK|GATEWAY_DIRECT|KAIXU_GATEWAY_PRIMARY)\s*=\s*)([^;]*'%s'[^;]*);" % re.escape(TARGET_URL),
        lambda m: f"{m.group(1)}(window.OMEGA_GATE_URL || localStorage.getItem('OMEGA_GATE_URL') || '{TARGET_URL}');",
        text
    )

    return text if text != orig else orig

changed = []
scanned = 0
for path in ROOT.rglob('*'):
    if not path.is_file():
        continue
    if path.suffix.lower() not in TEXT_EXTS:
        continue
    if any(part in {'.git','node_modules','dist','build','.next','.turbo','.cache'} for part in path.parts):
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        try:
            text = path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
    scanned += 1
    new = patch_file(path, text)
    if new != text:
        path.write_text(new, encoding='utf-8')
        changed.append(str(path.relative_to(ROOT)))

# add one gate config file for browser surfaces
cfg = ROOT / 'omega-gate.config.js'
cfg.write_text(
    f"window.OMEGA_GATE_URL = window.OMEGA_GATE_URL || localStorage.getItem('OMEGA_GATE_URL') || '{TARGET_URL}';\n",
    encoding='utf-8'
)

report = ROOT / 'OMEGA_GATE_CUTOVER_REPORT.md'
report.write_text('# 0mega Gate Truth Cutover Report\n\n'
                  f'- Root: `{ROOT}`\n'
                  f'- Target gate: `{TARGET_URL}`\n'
                  f'- Text files scanned: `{scanned}`\n'
                  f'- Files changed: `{len(changed)}`\n\n'
                  '## Changed files\n' + '\n'.join(f'- `{c}`' for c in changed) + '\n',
                  encoding='utf-8')

print(f'Scanned: {scanned}')
print(f'Changed: {len(changed)}')
for c in changed[:200]:
    print(c)
print('Wrote omega-gate.config.js and OMEGA_GATE_CUTOVER_REPORT.md')
