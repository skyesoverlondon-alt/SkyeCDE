Skye Mail Vault — Business Email Center (Netlify Functions + Neon)

What this is
Skye Mail Vault is a secure “business inbox” that behaves like a contact form + email inbox, except the message content is encrypted before it leaves the sender’s browser.



Enterprise hardening (what changed)
- Auth uses HttpOnly Secure SameSite=Strict cookies + CSRF token cookie/header (no JWT in localStorage).
- Email verification required before login; password reset flow included.
- IP-hashed rate events table + optional Cloudflare Turnstile bot checks for public endpoints.
- Inbox subject decrypt uses batched ciphertext fetch (avoids N+1).

Core properties
- Public address per user: /u/<handle> (example: https://yoursite/u/gray)
- Sender-side encryption: the send page fetches the recipient public key and encrypts {subject, message} in the browser (hybrid RSA-OAEP + AES-GCM).
- Ciphertext-only storage: Neon stores only ciphertext for message content and attachments.
- Email notifications (push): recipients get a notification email with a link (no plaintext message content is emailed).
- Vault Passphrase: recipients decrypt locally in the browser using a passphrase that never leaves the device.
- Key rotation + keyring: each user has versioned keys (old messages remain decryptable with older versions).

AI / kAIxuGateway13 compliance (optional feature)
This app includes an optional AI panel for summarizing/drafting replies.
All LLM traffic routes only through your Kaixu Gateway:
- Base: https://kaixugateway13.netlify.app
- Non-stream: POST /.netlify/functions/gateway-chat
- Stream (SSE): POST /.netlify/functions/gateway-stream
No OpenAI/Anthropic/Gemini SDKs. No direct provider endpoints exist in this repo.

Deploy (Netlify)
Important: this app requires Netlify Functions. A static-only drag/drop deploy will NOT run the backend.

1) Create a Neon Postgres database and run sql/schema.sql
2) Create a Netlify site from this folder (Deploy with Git recommended)
3) Add the environment variables below in Netlify → Site settings → Environment variables
4) Deploy. Then open /signup.html to create the first Vault.

Procurement Tier deployment
See DEPLOYMENT_PROCUREMENT_TIER.md for SAML SP-initiated SSO, SCIM, SIEM, DLP/Legal Hold/eDiscovery, and KMS setup.


Required environment variables
- DATABASE_URL=postgres://... (Neon connection string)
- JWT_SECRET=long_random_string
- RESEND_API_KEY=re_...
- NOTIFY_FROM_EMAIL=Verified Sender <notify@yourdomain.com>
- PUBLIC_BASE_URL=https://your-site.netlify.app   (recommended; used for links in email notifications)

Optional environment variables
Admin recovery (break-glass)
- ADMIN_RECOVERY_PUBLIC_KEY_PEM=-----BEGIN PUBLIC KEY-----...
- ADMIN_RECOVERY_PRIVATE_KEY_PEM=-----BEGIN PRIVATE KEY-----...   (only if you plan to decrypt recovery packs offline)
- ADMIN_RECOVERY_TOKEN=long_random_string                          (required to export recovery packs)

Inbound email (custom-domain addressing)
You have two inbound pathways:

A) VPS SMTP Bridge → /.netlify/functions/smtp-ingest
- This is “zero-trust friendly” because the bridge can encrypt client-side before POSTing to Netlify.
- Secured by HMAC signature header (SMTP_BRIDGE_SECRET).

Env:
- SMTP_BRIDGE_SECRET=long_random_string

B) Postmark inbound webhook → /.netlify/functions/inbound-postmark
- This pathway performs server-side encryption using the recipient public key.
- The plaintext email exists transiently inside the webhook handler, but ONLY ciphertext is stored in Neon.
- Lock the endpoint down using Basic Auth.

Env:
- INBOUND_DOMAIN=mail.yourdomain.com            (shown in the UI as handle@INBOUND_DOMAIN)
- INBOUND_PROVIDER=postmark
- INBOUND_BASIC_USER=someuser
- INBOUND_BASIC_PASS=somepass
Optional tuning:
- INBOUND_SPAM_SCORE_MAX=7.0
- INBOUND_MAX_TEXT_CHARS=200000

Routing behavior
- Any email sent to <handle>@INBOUND_DOMAIN is imported into that handle’s Vault inbox.
- Plus addressing is supported: handle+anything@INBOUND_DOMAIN routes to handle.

Operational limits (defaults)
- Max attachments: 6
- Max attachment size: 2 MB each
- Note: Netlify buffered functions have a 6 MB request payload limit; attachments are base64-encoded inside JSON, so keep total payload comfortably below that ceiling.
- Inbox list returns up to 200 most recent messages

Local test
- npm install
- netlify dev

Security notes (practical)
- The message subject + body are encrypted together and never stored in plaintext.
- Sender “From” fields (name/email) and timestamps are stored in plaintext so the recipient can identify who contacted them.
- Notifications never include message content.
- Tokens/JWT are stored in localStorage (standard SPA pattern). Treat XSS prevention as critical for any app extensions you add.

Production hardening checklist (recommended)
- Use a strong JWT_SECRET (32+ random bytes).
- Verify your NOTIFY_FROM_EMAIL domain and SPF/DKIM/DMARC.
- Set INBOUND_BASIC_USER/PASS if you enable inbound-postmark.
- Keep ADMIN_RECOVERY_PRIVATE_KEY_PEM offline if you enable recovery.
- Consider adding Cloudflare in front of the site if you want additional bot protection.


New env vars
- IP_HASH_SALT (required): used to hash client IPs before storing rate events.
- TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY (optional): enable Cloudflare Turnstile on send + thread pages.

Email verification & reset
- New accounts are created with email_verified=false.
- A verification email is sent on signup. Users must verify before login.
- /forgot.html requests a reset email; /reset.html consumes the token to set a new password.


Enterprise additions (v1.1)
- Organizations + RBAC (owner/admin/viewer) with invite + accept flows.
- Audit Log: immutable org-scoped event trail (login, key rotation, message access, invites).
- /health endpoint reports build_id + schema_version + db connectivity.
- Basic node:test unit tests scaffold.

New pages
- /org.html (members + invites)
- /audit.html (audit viewer)
- /accept-invite.html

New functions
- /org-me, /org-invite, /org-accept-invite
- /audit-list
- /health


SAML (SP-initiated) SSO
- Strict SP-initiated flow is supported. IdP-initiated responses are rejected.
- Configure per-org SAML settings via:
  - GET  /.netlify/functions/saml-config-get (owner/admin)
  - POST /.netlify/functions/saml-config-set (owner + CSRF)
- Start login:
  - /sso/saml/login?org=<org-slug>
- ACS endpoint:
  - /sso/saml/acs (POST from IdP)
- Requires env: SAML_SP_PRIVATE_KEY_PEM

Notes
- This build enforces SP-initiated by requiring a matching outstanding request ID (InResponseTo).
- Full XMLDSig signature verification is not implemented in this version; rely on IdP TLS + strict InResponseTo + issuer/destination checks.


Public Trust Pack
- /trust/controls.html
- /trust/subprocessors.html
- /trust/retention.html
- /trust/audit-format.html

Testing
- npm test (CSP/SAML/SCIM/SIEM contract tests)


### OIDC SSO
This build supports both **SAML (SP-initiated)** and **OIDC** SSO. OIDC is configured on `/procurement` (admin) and used via `/sso`.
