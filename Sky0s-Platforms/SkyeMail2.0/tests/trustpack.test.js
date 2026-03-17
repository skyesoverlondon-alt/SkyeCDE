const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("trust pack landing exists", () => {
  const p = path.join(__dirname, "..", "trust", "index.html");
  assert.ok(fs.existsSync(p), "trust/index.html must exist");
  const html = fs.readFileSync(p, "utf8");
  assert.ok(/Trust Pack/i.test(html), "trust index should mention Trust Pack");
});

test("security.txt exists", () => {
  const p = path.join(__dirname, "..", ".well-known", "security.txt");
  assert.ok(fs.existsSync(p), ".well-known/security.txt must exist");
  const txt = fs.readFileSync(p, "utf8");
  assert.ok(/Contact:/i.test(txt), "security.txt should include Contact");
});
