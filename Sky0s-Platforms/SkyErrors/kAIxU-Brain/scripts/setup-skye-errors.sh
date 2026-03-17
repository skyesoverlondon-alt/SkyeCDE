#!/usr/bin/env bash
set -euo pipefail

echo "== SkyeErrors setup (Cloudflare) =="
echo
echo "1) Create D1 database"
echo "   wrangler d1 create skye_errors_db"
echo
echo "2) Create R2 bucket"
echo "   wrangler r2 bucket create skye-errors-raw"
echo
echo "3) Apply schema"
echo "   wrangler d1 execute skye_errors_db --file=skye-errors/schema.sql"
echo
echo "4) Update wrangler.toml with the D1 database_id returned from step 1."
echo
echo "5) Set admin secret"
echo "   wrangler secret put SKYE_ERRORS_ADMIN_SECRET"
echo
echo "6) Deploy"
echo "   wrangler deploy"
