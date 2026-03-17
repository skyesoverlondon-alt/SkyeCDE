const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("retention sweep scheduled function exists", () => {
  const p = path.join(__dirname, "..", "netlify", "functions", "retention-sweep.js");
  assert.ok(fs.existsSync(p), "retention-sweep.js must exist");
  const txt = fs.readFileSync(p, "utf8");
  assert.ok(/schedule:\s*["']@daily["']/.test(txt), "retention-sweep must be scheduled daily");
});
