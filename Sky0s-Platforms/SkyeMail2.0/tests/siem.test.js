const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("SIEM drain is scheduled and present", () => {
  const p = path.resolve(__dirname, "..", "netlify", "functions", "siem-drain.js");
  const s = fs.readFileSync(p, "utf8");
  assert.ok(/schedule/i.test(s) && /@every\s+5m/i.test(s), "Expected scheduled SIEM drain.");
});

test("SIEM outbox table exists in schema", () => {
  const schema = fs.readFileSync(path.resolve(__dirname, "..", "sql", "schema.sql"), "utf8");
  assert.ok(/siem_outbox/i.test(schema), "Expected siem_outbox in schema.");
});
