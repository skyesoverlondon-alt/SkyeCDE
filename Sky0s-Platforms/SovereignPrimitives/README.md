# Sovereign Primitives Standalone

Standalone offline-first static console for sovereign infrastructure primitives:

- SKNore Zones
- SKYE Capsule export/import
- SKYE Sign & Release Seal
- Execution Guardrails
- Decision Ledger

## What this build is

This is a standalone V1 proof surface that runs as a static site with no server required.
It stores everything in localStorage and uses browser Web Crypto APIs for encryption and signing.

## Features

### SKNore Zones
- Create/edit/delete sovereign zones
- Define allow/deny rules for AI read/summarize/rewrite/delete
- Control export, publish, release, deploy, share, and human edit

### Objects & Labels
- Create text objects
- Import files as labeled objects
- Assign each object to a zone

### Execution Guardrails
- Evaluate action permission by subject + action + object zone
- Log every decision into the local ledger

### SKYE Capsule
- Encrypt one or many objects into a portable capsule JSON export
- AES-256-GCM envelope
- PBKDF2-SHA256 with 120000 iterations
- Offline import + decrypt + object rehydration

### Sign & Release Seal
- Generate a local ECDSA P-256 signing keypair
- Preview allowed vs blocked release items
- Sign a release seal manifest
- Verify the latest seal locally

### Ledger
- Review action decisions
- Review capsule and release seal history

## Files

- `index.html`
- `styles.css`
- `app.js`

## How to run

Open `index.html` directly in a browser or deploy the folder as a static site.

## Important note

This is standalone and intentionally not wired into your existing Netlify / Neon / Worker stack.
It is meant to give you sovereign primitives as isolated proof surfaces first.
