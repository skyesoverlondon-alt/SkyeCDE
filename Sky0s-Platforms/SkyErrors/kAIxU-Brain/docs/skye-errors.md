# SkyeErrors (Error Reporting) — kAIxU Brain Integration

This repo now includes a built-in error reporting lane ("SkyeErrors") hosted directly by the Brain Worker.

## Endpoints

All endpoints are CORS-enabled and use the Brain’s existing token auth (`Authorization: Bearer <token>` or `X-KAIXU-TOKEN`).

### Ingest (customer apps)
`POST /v1/errors/event`

Body (minimal):
```json
{
  "level": "error",
  "name": "Error",
  "message": "Something failed",
  "stack": "stack…",
  "tags": { "app": "my-worker", "tenant": "acme" },
  "release": "1.2.3",
  "environment": "prod",
  "request": { "method": "GET", "url": "https://example.com/boom", "cf_ray": "..." },
  "extra": { "anything": "you want" }
}
```

Response:
```json
{ "ok": true, "eventId": "...", "fingerprint": "..." }
```

### List (per-customer / per-token)
`GET /v1/errors/events?limit=50`

Returns only events for the calling token (tokenId preferred; hash fallback).

### Get one (per-customer / per-token)
`GET /v1/errors/events/:eventId`

Returns metadata + the raw payload stored in R2.

### Admin list (all tenants)
`GET /v1/admin/errors/events?limit=50`

Requires `X-SKYE-ERRORS-ADMIN: <secret>` where `<secret>` equals `SKYE_ERRORS_ADMIN_SECRET`.

### Admin cleanup (retention)
`POST /v1/admin/errors/cleanup`

Body:
```json
{ "days": 30 }
```

This deletes old metadata from D1 and best-effort deletes up to 500 matching raw R2 objects per call.
For large retention sweeps, configure an R2 lifecycle rule for the bucket.

## Storage bindings

SkyeErrors uses:
- D1 binding: `SKYE_ERRORS_DB`
- R2 binding: `SKYE_ERRORS_RAW`

Schema lives at: `skye-errors/schema.sql`

## SDK

A tiny Cloudflare Worker SDK is included at:

`skye-errors/sdk/skye-errors-sdk.mjs`

Example worker is included at:

`skye-errors/example-customer-worker/`

## Notes

- No cookies/headers are stored by default.
- URLs are stored without querystring by default (scrubbed).
- Grouping is basic fingerprinting (name+message+top of stack). You can extend it later.
