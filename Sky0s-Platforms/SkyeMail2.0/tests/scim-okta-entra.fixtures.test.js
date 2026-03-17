const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scimPatch = require("../netlify/functions/_scim_patch");

function load(rel){
  return JSON.parse(fs.readFileSync(path.join(__dirname, rel), "utf8"));
}

test("SCIM Users PATCH fixture: Okta-style operations map to {active,email}", () => {
  const body = load("fixtures/scim/okta/user_patch.json");
  const out = scimPatch.applyUserPatchOps(body);
  assert.equal(out.active, false);
  assert.equal(out.email, "new.user@acme.com");
});

test("SCIM Users PATCH fixture: Entra-style root replace maps to {active,email}", () => {
  const body = load("fixtures/scim/entra/user_patch.json");
  const out = scimPatch.applyUserPatchOps(body);
  assert.equal(out.active, true);
  assert.equal(out.email, "renamed@contoso.com");
});

test("SCIM Groups PATCH fixture: add/remove members parsed", () => {
  const body = load("fixtures/scim/okta/group_patch.json");
  const out = scimPatch.applyGroupPatchOps(body);
  assert.deepEqual(out.remove, ["11111111-1111-1111-1111-111111111111"]);
  assert.deepEqual(out.add, ["22222222-2222-2222-2222-222222222222"]);
});

test("SCIM Groups PUT fixture: normalizeMembers extracts ids", () => {
  const body = load("fixtures/scim/entra/group_put.json");
  const ids = scimPatch.normalizeMembers(body.members);
  assert.deepEqual(ids, ["33333333-3333-3333-3333-333333333333"]);
});
