const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("Cookie helper includes Secure + SameSite defaults (static contract)", () => {
  const p = path.resolve(__dirname, "..", "netlify", "functions", "_utils.js");
  const s = fs.readFileSync(p, "utf8");
  assert.ok(/function\s+cookie\s*\(/.test(s), "cookie() helper missing");
  assert.ok(/Secure/.test(s), "Expected Secure cookie attribute");
  assert.ok(/SameSite=Strict/.test(s) || /SameSite/.test(s), "Expected SameSite handling");
  assert.ok(/HttpOnly/.test(s), "Expected HttpOnly support");
});
