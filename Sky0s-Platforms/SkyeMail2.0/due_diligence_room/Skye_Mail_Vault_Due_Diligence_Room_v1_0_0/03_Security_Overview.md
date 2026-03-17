# Security Overview — Skye Mail Vault — Business Email Center

Effective date: February 21, 2026

## Security goals
1. Keep message content confidential at rest (ciphertext storage).
2. Keep vault passphrases off the server.
3. Minimize blast radius from browser compromise and server compromise.
4. Resist common web attacks (XSS/CSRF, auth abuse, bot spam).
5. Provide predictable operations (rate-limits, monitoring, incident response).

## Core controls

### Authentication and sessions
- HttpOnly, Secure, SameSite=Strict auth cookies for web sessions.
- CSRF enforced on state-changing requests (double-submit cookie + header).
- Email verification required prior to successful login.
- Password reset tokens are expiring and stored only as hashes in the database.

### Browser hardening
- Strict CSP: no inline scripts/styles; only required domains allowed.
- Security headers: HSTS, nosniff, frame-ancestors 'none', referrer-policy, etc.
- Output escaping for user-controlled strings rendered in the UI.

### Cryptography
- Message encryption: AES-GCM for content + RSA-OAEP for key wrapping.
- Vault private key protection: private key wrapped client-side via PBKDF2 + AES-GCM.
- Key rotation: versioned keyring; each message stores `key_version`.
- Attachments: encrypted with the same hybrid scheme as messages.

Not encrypted:
- Essential metadata: timestamps, sender identifiers (if provided), attachment filename/type/size, thread IDs, read state, rate-limit bucket IDs.

### Abuse and bot defenses
- Hashed-IP rate limiting for public endpoints.
- Optional Cloudflare Turnstile challenge.
- Secondary sender-based throttles.

### Data access controls
- Messages and attachments are accessible only to an authenticated account owner (or via a valid thread token for reply flow).
- Notification emails contain links only, not plaintext message content.

## Known boundaries
- If a device is compromised (malware/keylogger), decrypted content can be exposed.
- Inbound provider mode cannot prevent plaintext exposure prior to encryption.
- This is posture documentation, not a formal certification.
