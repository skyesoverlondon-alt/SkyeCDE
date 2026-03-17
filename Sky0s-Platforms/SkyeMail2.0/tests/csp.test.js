const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

function walk(dir){
  const out = [];
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if(st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test("No inline scripts/styles/style-attrs in HTML (CSP strict)", () => {
  const root = path.resolve(__dirname, "..");
  const files = walk(root).filter(p => p.endsWith(".html"));
  for(const f of files){
    const s = fs.readFileSync(f, "utf8");
    assert.ok(!/<script\b(?![^>]*\bsrc=)/i.test(s), `Inline <script> found in ${f}`);
    assert.ok(!/<style\b/i.test(s), `Inline <style> found in ${f}`);
    assert.ok(!/\sstyle\s*=\s*["']/i.test(s), `Inline style attribute found in ${f}`);
  }
});
