const { query } = require("./_db");

async function enqueueSiem(orgId, payloadObj){
  try{
    if(!orgId) return;
    const cfg = await query(
      `select enabled, provider, endpoint, token_enc
       from siem_configs where org_id=$1 limit 1`,
      [orgId]
    );
    if(!cfg.rows.length || !cfg.rows[0].enabled) return;

    const c = cfg.rows[0];
    const payload_json = JSON.stringify(payloadObj).slice(0, 50000);

    await query(
      `insert into siem_outbox(org_id, provider, endpoint, token_enc, payload_json)
       values($1,$2,$3,$4,$5)`,
      [orgId, c.provider, c.endpoint, c.token_enc, payload_json]
    );
  }catch(e){
    // never block
  }
}

module.exports = { enqueueSiem };
