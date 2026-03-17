const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("OIDC functions exist", () => {
  const base = path.resolve(__dirname, "..", "netlify", "functions");
  const files = fs.readdirSync(base);
  for(const f of ["oidc-config-get.js","oidc-config-set.js","oidc-discovery.js","sso-oidc-login.js","sso-oidc-callback.js","sso-discovery.js"]){
    assert.ok(files.includes(f), "Missing " + f);
  }
});

test("OIDC tables exist in schema", () => {
  const schema = fs.readFileSync(path.resolve(__dirname, "..", "sql", "schema.sql"), "utf8");
  assert.ok(/oidc_configs/i.test(schema), "Expected oidc_configs in schema.");
  assert.ok(/allowed_tenants_csv/i.test(schema), "Expected allowed_tenants_csv in schema.");
  assert.ok(/oidc_states/i.test(schema), "Expected oidc_states in schema.");
});

test("SSO and SIEM routes are in _redirects", () => {
  const r = fs.readFileSync(path.resolve(__dirname, "..", "_redirects"), "utf8");
  assert.ok(/\/sso\/oidc\/login/i.test(r));
  assert.ok(/\/sso\/oidc\/callback/i.test(r));
  assert.ok(/\/siem\s+\/siem\.html/i.test(r));
});


test("OIDC callback supports Entra tenant-specific issuers (tid)", () => {
  const cb = fs.readFileSync(path.resolve(__dirname, "..", "netlify", "functions", "sso-oidc-callback.js"), "utf8");
  assert.ok(/decodeJwt\(/.test(cb), "Expected decodeJwt usage for multi-tenant validation.");
  assert.ok(/login\.microsoftonline\.com/.test(cb), "Expected Entra issuer handling.");
  assert.ok(/tid/.test(cb), "Expected tid handling.");
});
