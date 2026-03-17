# Acquirer One‑Pager — Skye Mail Vault — Business Email Center (v1.0.2)

Effective date: February 21, 2026  
Owner / Vendor: Skyes Over London LC (Phoenix, Arizona, United States)  
Contact: SkyesOverLondonLC@solenterprises.org

## What it is
Skye Mail Vault — Business Email Center is a secure messaging vault for businesses that want a “public-facing inbox” without exposing message content to intermediaries. Senders submit messages to a vault handle page (e.g., /u/handle). Content is encrypted for the recipient before storage, and recipients decrypt locally after vault unlock. The platform also supports secure thread reply links and encrypted attachments.

## Why it matters (buyer framing)
This is a privacy-forward alternative to contact forms that email plaintext. It converts inbound communications into an access-controlled, encrypted inbox—suitable for compliance-heavy intake workflows (agencies, property managers, legal intake, accounting, and other sensitive business communications).

## Differentiators
- Ciphertext-at-rest by design: message bodies and attachments stored encrypted
- Key rotation with versioned keyring (old messages remain decryptable)
- Secure thread replies via unguessable token links
- Strict CSP (no inline scripts/styles), HttpOnly auth cookies + CSRF
- Email verification + password reset built-in
- Hashed-IP rate limiting; optional bot wall (Cloudflare Turnstile)
- Optional AI assist via Kaixu Gateway (explicit user action)

## System boundaries (what is and is not encrypted)
Encrypted:
- Message body and subject (ciphertext)
- Attachments (ciphertext)

Not encrypted (metadata):
- Sender email (if provided), sender name (if provided)
- Timestamps, message IDs, thread IDs/token hashes
- Delivery status events, attachment sizes and filenames
- Rate-limit buckets (hashed IP)

Inbound email note:
- Standard email is plaintext before it reaches an inbound webhook/bridge. Inbound mode is an opt-in feature with explicit disclosure.

## Architecture (summary)
- Static web app (Netlify hosting) + serverless functions
- Postgres database (Neon)
- Outbound notifications via Resend (no plaintext content in notification emails)
- Optional bot defense via Cloudflare Turnstile
- Optional inbound provider (Postmark) or SMTP bridge (VPS) into the same pipeline
- Optional AI assistance routed through Kaixu Gateway

## Key operational metrics (what a buyer should track)
- Function error rate and latency (p95)
- Database connections, CPU, storage growth
- Message throughput per vault/day
- Email delivery success rate (Resend)
- Abuse attempts blocked (rate-limits/Turnstile)

## Primary risks (transparent)
- Abuse pressure: public intake endpoints require rate-limit/bot controls
- Attachment sizes constrained by serverless payload ceilings unless object storage is added
- Email deliverability is operationally sensitive (SPF/DKIM/DMARC)

## IP & ownership notes
- Codebase and product branding are owned by Skyes Over London LC.
- No proprietary third-party assets are required beyond listed subprocessors.
