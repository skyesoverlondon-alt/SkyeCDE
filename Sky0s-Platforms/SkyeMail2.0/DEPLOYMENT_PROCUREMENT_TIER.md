# Skye Mail Vault — Business Email Center
## Procurement Tier Deployment Guide (v1.3)

This guide covers the additional deployment steps for Procurement Tier features:
- SAML SP-Initiated SSO (signed AuthnRequest + signed response validation)
- SCIM provisioning (Users/Groups)
- SIEM export (Splunk HEC / Datadog Logs) + outbox drain
- DLP + Legal Hold + eDiscovery
- KMS/HSM-managed keys (AWS KMS)

> Baseline Netlify + Neon setup is in README.md under “Deploy (Netlify)”. This doc adds the procurement modules.

---

## 1) Database migration
Run `sql/schema.sql` against your Neon database (required).

---

## 2) Required environment variables (procurement tier)

### AWS KMS (required for KMS-mode keys and encrypted configs)
- `AWS_REGION`
- `CONFIG_KMS_KEY_ID`  (KMS key id/arn used to encrypt config secrets like SIEM tokens)
Optional depending on Netlify environment:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### SAML SP-Initiated SSO (per org)
- `SAML_SP_ENTITY_ID` (e.g., `https://YOUR-SITE.netlify.app/sso/saml/metadata`)
- `SAML_SP_PRIVATE_KEY_PEM` (PEM private key used to sign AuthnRequest)
- `SAML_SP_PUBLIC_CERT_PEM` (PEM cert presented as SP signing cert)

### SIEM export (optional)
- `SIEM_ENABLED=true` (optional flag if you want a global toggle)

### Turnstile bot defense (optional but recommended)
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

---

## 3) SAML SP-Initiated SSO setup (Org Admin)

1. Log in as an org owner/admin.
2. Open `/procurement.html` and configure:
   - IdP Entity ID
   - IdP SSO URL
   - IdP X.509 Signing Certificate (paste PEM)
   - SP Entity ID (should match `SAML_SP_ENTITY_ID`)
3. In your IdP (Okta/AzureAD/etc):
   - Set ACS URL to: `https://YOUR-SITE.netlify.app/.netlify/functions/sso-saml-acs?org=ORG_SLUG`
   - Upload SP signing cert: `SAML_SP_PUBLIC_CERT_PEM`
   - Ensure Assertions are signed.
4. SP-Initiated login URL:
   - `https://YOUR-SITE.netlify.app/.netlify/functions/sso-saml-login?org=ORG_SLUG`

---

## 4) SCIM provisioning (Org Admin)

1. In `/procurement.html`, generate a SCIM token (shown once).
2. Configure your IdP SCIM app:
   - Base URL: `https://YOUR-SITE.netlify.app/scim/v2`
   - Token: the generated SCIM token
3. Endpoints:
   - `GET/POST/PATCH/PUT /scim/v2/Users`
   - `GET/PATCH/PUT /scim/v2/Groups`

Notes:
- SCIM requires org `KMS` key management mode (so users can be provisioned without passphrases).

---

## 5) SIEM export (Splunk/Datadog)

1. In `/procurement.html`, set SIEM destination and token:
   - Splunk: HEC URL + HEC token
   - Datadog: intake URL + API key
2. Tokens are encrypted with KMS (CONFIG_KMS_KEY_ID).
3. Drain job:
   - `/.netlify/functions/siem-drain` runs on schedule (`@every 5m`).
4. Verify:
   - Check `siem_outbox` table decreasing and events arriving in SIEM.

---

## 6) DLP policy + Legal Hold + eDiscovery

### DLP
- Set policy in `/procurement.html` or via functions:
  - `/.netlify/functions/dlp-policy-set` (admin)
  - `/.netlify/functions/dlp-policy-get` (admin)
- Enforcement:
  - Web send/thread: client pre-check (blocks/warns before encrypting)
  - Inbound email: server-side enforcement (logs `dlp_events`)

### Legal Hold
- `/.netlify/functions/legal-hold-set`
- `/.netlify/functions/legal-hold-release`
- `/.netlify/functions/legal-hold-list`

When a message is under legal hold:
- deletion is blocked
- “delete” becomes soft-delete only where allowed

### eDiscovery
- `/.netlify/functions/ediscovery-export?type=messages` (ciphertext + metadata)
- `/.netlify/functions/ediscovery-export?type=audit` (audit trail)

---

## 7) KMS-mode keys (Org)

To use KMS-managed keys:
1. Set org key management mode to `kms` in `/procurement.html`.
2. Key rotation will generate/wrap keys server-side.
3. Users unlock via KMS unseal endpoint after login.

---

## 8) Quick validation checklist
- `/.netlify/functions/health` returns db_ok=true, build_id, schema_version
- SAML SP-initiated login works end-to-end
- SIEM drain successfully delivers at least one audit event
- SCIM creates a user + group membership
- DLP event appears in `dlp_events` after a blocked/warned message attempt


## Session revocation (Fortune-500 hardening)
- Password-login issues a server-tracked session (sessions table) and JWT includes jti.
- Every authenticated request validates the session and the user's active status.
- SCIM deprovision (active=false) immediately revokes all sessions for that user.
- You can self-manage sessions at /sessions.html.


## OIDC SSO (in addition to SAML)

OIDC is configured per-organization and stored encrypted using CONFIG_KMS_KEY_ID.


Entra multi-tenant issuer pattern (Fortune-500 common issue)
- For Entra multi-tenant apps, configure issuer as:
  `https://login.microsoftonline.com/common/v2.0`
  (or `organizations`/`consumers`).
- The `id_token` issuer (`iss`) is tenant-specific (`tid`). The callback validates this and will compute:
  `https://login.microsoftonline.com/<tid>/v2.0`
- Optional: restrict allowed tenants using **Allowed tenant IDs (CSV)** in the OIDC config.
- OIDC endpoint discovery helper:
  `/.netlify/functions/oidc-discovery?issuer=<issuer>`
  (also available at `/oidc/discovery?issuer=...`).

1) Ensure the org is in KMS mode (`Procurement` page → KMS / Key Management).
2) In `Procurement` page, configure **OIDC SSO**:
   - Issuer (e.g., Entra tenant issuer)
   - Client ID
   - Client Secret (write-only; stored encrypted)
   - Scopes (default: `openid email profile`)
   - Allowed domains (optional)
3) Users can sign in via `/sso` using the org slug.

Callback URL:
- `/sso/oidc/callback` (the app routes this to the Netlify function)

