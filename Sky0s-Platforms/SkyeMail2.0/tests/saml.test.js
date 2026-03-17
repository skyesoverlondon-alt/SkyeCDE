const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("SAML ACS uses signature-validation library and InResponseTo enforcement", () => {
  const p = path.resolve(__dirname, "..", "netlify", "functions", "sso-saml-acs.js");
  const s = fs.readFileSync(p, "utf8");
  assert.ok(/@node-saml\/node-saml|node-saml/i.test(s), "Expected node-saml usage in ACS.");
  assert.ok(/InResponseTo/i.test(s), "Expected InResponseTo enforcement.");
});

test("SAML SP-initiated login endpoint exists", () => {
  const p = path.resolve(__dirname, "..", "netlify", "functions", "sso-saml-login.js");
  assert.ok(fs.existsSync(p), "Missing SP-initiated SAML login endpoint.");
});

test("SAML per-org signature toggles are supported", () => {
  const p = path.resolve(__dirname, "..", "netlify", "functions", "sso-saml-acs.js");
  const s = fs.readFileSync(p, "utf8");
  assert.ok(/want_assertions_signed/i.test(s), "Expected want_assertions_signed config usage.");
  assert.ok(/want_response_signed/i.test(s), "Expected want_response_signed config usage.");
});
