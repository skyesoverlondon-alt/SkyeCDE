# Architecture & Data Flow — Skye Mail Vault — Business Email Center

Effective date: February 21, 2026

## Components
1. **Web Client (Browser SPA)**  
   UI for signup, login, inbox, message view, thread reply, and keys. Performs client-side encryption/decryption.

2. **API Layer (Netlify Functions)**  
   Authentication, vault provisioning, message submission/retrieval, thread replies, attachments retrieval, inbound ingestion, rate limiting, and email notifications.

3. **Database (Neon Postgres)**  
   Users, keyrings (public keys + wrapped private keys), message ciphertext, attachment ciphertext, thread token hashes, and rate-limit events.

4. **Outbound Email (Resend)**  
   Sends notification emails containing links only (no plaintext message content).

5. **Optional Bot Defense (Cloudflare Turnstile)**  
   Challenges submissions on public endpoints.

6. **Optional Inbound Email (Postmark or SMTP Bridge)**  
   Imports inbound email into the ciphertext vault pipeline.

7. **Optional AI Assist (Kaixu Gateway)**  
   Used only when a user clicks AI actions (summarize/draft).

## Trust boundaries
- **Browser boundary**: Vault Passphrase and unwrapped private keys must never leave the device.
- **Server boundary**: Server stores ciphertext and wrapped private keys; it does not have vault passphrases.
- **Email boundary**: Notification emails must not contain plaintext content.
- **Inbound boundary**: Standard email is plaintext before encryption; inbound mode is opt-in.

## Data model (high level)
- `users`: identity, password hash, verification/reset state
- `user_keys`: versioned keyring, active key flag, public key PEM, wrapped private key JSON
- `threads`: recipient, sender identity, token hash, timestamps
- `messages`: ciphertext + wrapped AES key + IV + key_version, plus metadata/read state
- `attachments`: ciphertext bytes + wrapped AES key + IV + key_version, plus filename/type/size
- `rate_events`: hashed-IP bucket events

## End-to-end flows

### A) Signup → Verified account
1. User enters email/handle/password and chooses a Vault Passphrase.
2. Client generates RSA keypair locally.
3. Client wraps private key using passphrase-derived key (PBKDF2 + AES-GCM) producing `vault_wrap_json`.
4. Client POSTs signup payload (public key + wrapped private key JSON).
5. Server creates user, keyring v1 (active), and generates an email verification token (stored hashed).
6. Server emails verification link.
7. User verifies; server marks `email_verified=true`.

### B) Login (cookie auth)
1. User submits email+password.
2. Server verifies bcrypt password hash and ensures email_verified.
3. Server sets HttpOnly auth cookie + CSRF cookie.
4. Client uses cookies for subsequent requests and attaches CSRF header on writes.

### C) Public send (/u/handle) → ciphertext stored
1. Sender visits /u/handle (redirect to send page).
2. Client fetches recipient active public key + key_version.
3. Client encrypts message (subject+body) with hybrid encryption:
   - AES-GCM encrypt plaintext using random AES key
   - RSA-OAEP encrypt AES key to recipient public key
4. Client uploads ciphertext payload.
5. Server rate-limits (hashed IP + optional Turnstile), stores ciphertext + metadata, creates/updates a thread token.
6. Server emails recipient a notification link and emails sender the secure thread link.

### D) Thread reply (token) → ciphertext stored + notify
1. Sender opens thread URL with token.
2. Server resolves token to recipient and returns recipient active public key.
3. Client encrypts reply and uploads ciphertext.
4. Server stores ciphertext reply and emails recipient notification.

### E) Inbox view → local decryption
1. Client loads message headers list.
2. On unlock, client unwraps vault private keys locally using the Vault Passphrase.
3. Client requests ciphertext batch for newest messages and decrypts locally.
4. Opening a message decrypts body locally; attachments decrypt on-demand.

### F) Attachments
Client encrypts attachment bytes and wraps the AES key to recipient’s RSA key. Server stores ciphertext bytes. Client downloads ciphertext and decrypts locally.

### G) Inbound email ingestion (opt-in)
- SMTP bridge: upstream encrypts then posts ciphertext.
- Provider webhook: provider posts plaintext; the service encrypts server-side then stores ciphertext.
