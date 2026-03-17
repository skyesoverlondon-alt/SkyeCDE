const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("SCIM endpoints exist", () => {
  const users = path.resolve(__dirname, "..", "netlify", "functions", "scim-users.js");
  const groups = path.resolve(__dirname, "..", "netlify", "functions", "scim-groups.js");
  assert.ok(fs.existsSync(users), "Missing scim-users.js");
  assert.ok(fs.existsSync(groups), "Missing scim-groups.js");
});

test("SCIM redirects are configured", () => {
  const red = fs.readFileSync(path.resolve(__dirname, "..", "_redirects"), "utf8");
  assert.ok(/\/scim\/v2\/Users/i.test(red), "Missing SCIM Users redirect.");
  assert.ok(/\/scim\/v2\/Users\/\*/i.test(red), "Missing SCIM Users wildcard redirect.");
  assert.ok(/\/scim\/v2\/Groups/i.test(red), "Missing SCIM Groups redirect.");
  assert.ok(/\/scim\/v2\/Groups\/\*/i.test(red), "Missing SCIM Groups wildcard redirect.");
});
