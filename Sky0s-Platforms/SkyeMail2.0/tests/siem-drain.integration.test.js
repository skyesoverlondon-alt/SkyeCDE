const test = require("node:test");
const assert = require("node:assert/strict");

const { drainOnce } = require("../netlify/functions/siem-drain");

// A tiny SQL router for mocked query function
function makeQueryMock(rows){
  const calls = [];
  const state = { rows: rows.slice(), outboxByOrg: new Map() };

  // initialize backlog counts
  for(const r of state.rows){
    const k = String(r.org_id||"");
    state.outboxByOrg.set(k, (state.outboxByOrg.get(k)||0) + 1);
  }

  const queryFn = async (sql, params) => {
    calls.push({ sql: String(sql), params: params || [] });

    const s = String(sql).toLowerCase().trim();

    if(s.includes("select id") && s.includes("from siem_outbox")){
      return { rows: state.rows.slice() };
    }
    if(s.startsWith("delete from siem_outbox")){
      const id = params[0];
      const row = state.rows.find(r => r.id === id);
      if(row){
        const k = String(row.org_id||"");
        state.outboxByOrg.set(k, Math.max(0, (state.outboxByOrg.get(k)||0)-1));
      }
      state.rows = state.rows.filter(r => r.id !== id);
      return { rows: [] };
    }
    if(s.startsWith("update siem_outbox")){
      // keep row but count as updated
      return { rows: [] };
    }

    // SIEM runs insert
    if(s.startsWith("insert into siem_runs")){
      return { rows: [] };
    }

    // Alert config: none by default
    if(s.includes("from siem_alert_configs")){
      return { rows: [] };
    }
    if(s.includes("from siem_alert_events")){
      return { rows: [] };
    }

    // backlog count
    if(s.includes("select count(*)") && s.includes("from siem_outbox") && s.includes("where org_id=$1")){
      const orgId = String(params[0]||"");
      return { rows: [{ c: state.outboxByOrg.get(orgId)||0 }] };
    }
    if(s.includes("select min(created_at)") && s.includes("from siem_outbox")){
      return { rows: [{ t: null }] };
    }

    return { rows: [] };
  };

  return { queryFn, calls, getRows: () => state.rows };
}

test("SIEM drainOnce sends events and deletes successful outbox rows", async () => {
  const initialRows = [
    {
      id: 1,
      org_id: "org1",
      provider: "splunk",
      endpoint: "https://splunk.example/hec",
      token_enc: "ENC1",
      payload_json: JSON.stringify({ type:"AUDIT", action:"LOGIN", ts:"2026-01-01T00:00:00Z" }),
      tries: 0
    },
    {
      id: 2,
      org_id: "org1",
      provider: "datadog",
      endpoint: "https://http-intake.logs.datadoghq.com/api/v2/logs",
      token_enc: "ENC2",
      payload_json: JSON.stringify({ message:"hello", service:"smv", ddsource:"node" }),
      tries: 1
    }
  ];

  const { queryFn, calls, getRows } = makeQueryMock(initialRows);

  const kmsDecrypt = async (tokenEnc) => {
    assert.ok(tokenEnc === "ENC1" || tokenEnc === "ENC2");
    return "TOKEN";
  };

  const fetchFn = async (url, opts) => {
    assert.ok(url.startsWith("https://"));
    assert.equal(opts.method, "POST");
    return { ok:true, status:200 };
  };

  const out = await drainOnce({ queryFn, kmsDecrypt, fetchFn, limit: 50 });
  assert.equal(out.ok, true);
  assert.equal(out.sent, 2);
  assert.equal(out.failed, 0);
  assert.equal(getRows().length, 0);

  const deletes = calls.filter(c => c.sql.toLowerCase().startsWith("delete from siem_outbox"));
  assert.equal(deletes.length, 2);
});

test("SIEM drainOnce records failures and schedules retry", async () => {
  const initialRows = [
    {
      id: 3,
      org_id: "org1",
      provider: "splunk",
      endpoint: "https://splunk.example/hec",
      token_enc: "ENC3",
      payload_json: JSON.stringify({ type:"AUDIT", action:"FAIL", ts:"2026-01-01T00:00:00Z" }),
      tries: 0
    }
  ];

  const { queryFn, calls, getRows } = makeQueryMock(initialRows);

  const kmsDecrypt = async () => "TOKEN";

  const fetchFn = async () => ({ ok:false, status: 500 });

  const out = await drainOnce({ queryFn, kmsDecrypt, fetchFn });
  assert.equal(out.ok, true);
  assert.equal(out.sent, 0);
  assert.equal(out.failed, 1);
  assert.equal(getRows().length, 1);

  const updates = calls.filter(c => c.sql.toLowerCase().startsWith("update siem_outbox"));
  assert.equal(updates.length, 1);
});
