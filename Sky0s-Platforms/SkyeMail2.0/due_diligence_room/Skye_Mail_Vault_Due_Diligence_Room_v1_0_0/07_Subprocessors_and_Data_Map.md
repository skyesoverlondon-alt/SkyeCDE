# Subprocessors & Data Map — Skye Mail Vault — Business Email Center

Effective date: February 21, 2026

## Default subprocessors
1) Netlify — hosting + serverless functions  
2) Neon (Postgres) — primary database  
3) Resend — outbound notification email delivery

## Optional subprocessors
4) Cloudflare Turnstile — bot challenge (if enabled)  
5) Postmark — inbound email webhooks (if enabled)  
6) Kaixu Gateway — AI routing for optional AI assist (if enabled and used)

## Data categories
Account:
- email, handle, password hash, verification/reset token hashes, login timestamps

Security:
- session cookies, CSRF cookie, hashed-IP rate bucket events, logs

Messages:
- ciphertext message content; plaintext metadata (timestamps, sender email/name if provided)

Attachments:
- ciphertext bytes; plaintext metadata (filename/type/size)

## Customer responsibilities
- Configure sender DNS for deliverability (SPF/DKIM/DMARC).
- Enable inbound mode only if acceptable for their security posture.
- Use AI assist only when content is acceptable to be processed by the configured AI routing service.
