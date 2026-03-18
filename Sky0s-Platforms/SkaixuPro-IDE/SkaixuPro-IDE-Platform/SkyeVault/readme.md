# SkyePortal Vault — Control Plane (Netlify-ready)

This is your personal **one-stop shop** for:
- Neon stack registry (dev/stage/prod)
- Versioned infra packs for Neon SQL and Cloudflare R2 manifests
- App identities (app_id / allowed origins)
- Env profiles (public env + encrypted private env stored inside the vault)
- Netlify Broker functions to mint short-lived scoped JWTs, apply Neon SQL, and publish Cloudflare R2 manifests server-side

## 1) Deploy to Netlify
1. Create a new Netlify site from this folder (or drop it into your existing repo).
2. Set these **Netlify environment variables**:

### Required
- `VAULT_SIGNING_SECRET`  
  A long random string (32+ chars). Used to sign short-lived JWTs.

- `VAULT_APP_SECRETS`  
  JSON map of app IDs to secrets, e.g.
  ```json
  {
    "vault-ui": "CHANGE_ME_TO_A_LONG_SECRET",
    "skaixuide": "ANOTHER_LONG_SECRET"
  }
  ```

- `DATABASE_URL`  
  Neon/Postgres connection string used when applying SQL from an infra pack.

- `CLOUDFLARE_ACCOUNT_ID`  
  Cloudflare account ID for the target R2 account.

- `CLOUDFLARE_R2_ACCESS_KEY_ID`  
  R2 access key with write access to the manifest bucket.

- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`  
  Matching R2 secret access key.

- `VAULT_R2_MANIFEST_BUCKET`  
  Default R2 bucket used when a stack does not specify its own bucket.

### Optional
- `VAULT_TOKEN_TTL_SECONDS`  
  Default `300` (5 minutes). Shorter is safer.

- `VAULT_PUBLIC_CONFIG_JSON`  
  JSON map of app IDs to public config and endpoints:
  ```json
  {
    "vault-ui": {
      "public": { "FEATURE_FLAGS": "vault" },
      "endpoints": { "broker": "/.netlify/functions" }
    },
    "skaixuide": {
      "public": { "R2_PUBLIC_BASE_URL": "https://cdn.example.com", "SOME_FLAG": "1" },
      "endpoints": { "broker": "https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions" }
    }
  }
  ```

## 2) Use the Vault UI
- Open the deployed site
- Choose **Initialize new vault** (first time)
- Create:
  - Stacks
  - Infra Packs
  - Apps
  - Env Profiles
- In the **Broker tab**:
  - Set Broker URL to your site URL
  - Use app_id `vault-ui` and the secret you set in `VAULT_APP_SECRETS`
  - Mint token
  - Apply SQL and publish R2 manifests to a chosen stack

## 3) Security model (non-negotiable)
- The vault encrypts data locally; exports are encrypted blobs.
- The Broker never sends database credentials or bucket keys to the browser.
- Apps should receive only non-secret config or short-lived tokens.

## 4) API endpoints (Broker)
- `POST /.netlify/functions/mint`
  - body: `{ app_id, app_secret, scopes: [] }`
  - returns: `{ token, expires_in }`

- `GET /.netlify/functions/config?app_id=...`
  - returns app-specific public config from `VAULT_PUBLIC_CONFIG_JSON`

- `POST /.netlify/functions/deployinfra`
  - header: `Authorization: Bearer <token>`
  - scope required: `infra:deploy`
  - body: `{ stackId, sqlBootstrap, r2Manifest, r2Bucket }`

## 5) Local dev
You can run this locally with Netlify CLI:
- `npm i -g netlify-cli`
- `netlify dev`

Set the same env vars locally (Netlify CLI will read a `.env` if you create one).
