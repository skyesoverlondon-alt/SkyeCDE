const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

function loadScimUsersWithMocks({ queryMock }){
  const dbPath = path.resolve(__dirname, "..", "netlify", "functions", "_db.js");
  const utilsPath = path.resolve(__dirname, "..", "netlify", "functions", "_utils.js");
  const kmsPath = path.resolve(__dirname, "..", "netlify", "functions", "_kms.js");
  const modPath = path.resolve(__dirname, "..", "netlify", "functions", "scim-users.js");

  // Clear cache
  for(const p of [dbPath, utilsPath, kmsPath, modPath]){
    delete require.cache[p];
  }

  // Mocked _db
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: queryMock } };

  // Mocked _kms
  require.cache[kmsPath] = { id: kmsPath, filename: kmsPath, loaded: true, exports: { kmsEncryptToB64: async () => "ENC" } };

  // Mocked _utils (only what scim-users destructures; behavior is minimal)
  const json = (statusCode, obj) => ({ statusCode, headers: { "content-type":"application/json" }, body: JSON.stringify(obj) });
  const noop = async () => {};
  require.cache[utilsPath] = {
    id: utilsPath,
    filename: utilsPath,
    loaded: true,
    exports: {
      json,
      jsonCookies: (statusCode, obj) => json(statusCode, obj),
      parseJson: () => ({}),
      requireEnv: () => "x",
      issueAuthCookies: () => [],
      clearAuthCookies: () => [],
      parseCookies: () => ({}),
      cookie: () => "",
      getClientIp: () => "127.0.0.1",
      hashIp: () => "iph",
      randomToken: () => "tok",
      enforceRateLimit: noop,
      verifyTurnstile: noop,
      verifyAuthSession: () => ({ sub: "u" }),
      revokeSessionByJti: noop,
      revokeAllSessionsForUser: noop,
      requireCsrf: noop
    }
  };

  // Stub external modules not installed in the test runner environment
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain){
    if(request === "bcryptjs") return { hash: async () => "x", compare: async () => true };
    // allow built-ins and project files to resolve normally
    return originalLoad.apply(this, arguments);
  };

  try{
    return require(modPath);
  } finally {
    Module._load = originalLoad;
  }
}

test("SCIM deprovision (active=false) revokes sessions immediately", async () => {
  const calls = [];

  const ORG_ID = "11111111-1111-1111-1111-111111111111";
  const USER_ID = "22222222-2222-2222-2222-222222222222";
  const KMS_KEY = "arn:aws:kms:us-east-1:123456789012:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  const queryMock = async (sql, params=[]) => {
    const s = String(sql);
    calls.push({ sql: s, params });

    const low = s.toLowerCase();

    // Require SCIM token lookup
    if(low.includes("from scim_tokens") && low.includes("join organizations")){
      return { rows: [{ org_id: ORG_ID, revoked_at: null, key_management_mode: "kms", kms_key_id: KMS_KEY }] };
    }

    // Existing user lookup
    if(low.includes("select id, handle, email, is_active") && low.includes("from users") && low.includes("where org_id=$1") && low.includes("and id=$2")){
      return { rows: [{ id: USER_ID, handle: "jane", email: "jane@acme.com", is_active: true }] };
    }

    // Update users returning
    if(low.startsWith("update users set email=$1, is_active=$2")){
      return { rows: [{ id: USER_ID, handle: "jane", email: "jane@acme.com", is_active: false }] };
    }

    return { rows: [] };
  };

  const { handler } = loadScimUsersWithMocks({ queryMock });

  const patchBody = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    Operations: [{ op: "Replace", path: "active", value: false }]
  };

  const event = {
    httpMethod: "PATCH",
    path: "/scim/v2/Users/" + USER_ID,
    headers: { Authorization: "Bearer TEST_SCIM_TOKEN" },
    body: JSON.stringify(patchBody)
  };

  const res = await handler(event);
  assert.equal(res.statusCode, 200, "Expected 200 from SCIM PATCH");

  const sqlAll = calls.map(c => c.sql.toLowerCase()).join("\n");
  assert.ok(sqlAll.includes("update sessions set revoked_at=now()"), "Expected session revocation SQL");
  assert.ok(sqlAll.includes("scim_deprovision"), "Expected scim_deprovision reason");
});
