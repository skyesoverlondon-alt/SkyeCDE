const { query } = require("./_db");
const { json, requireMethod } = require("./_utils");
const { getOrgContext, requireAdmin } = require("./_orgauth");

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const ctx = await getOrgContext(event);
    requireAdmin(ctx.role);

    const cfg = await query(
      `select enabled, provider, endpoint from siem_configs where org_id=$1 limit 1`,
      [ctx.orgId]
    );

    const outCount = await query(`select count(*)::int as c from siem_outbox where org_id=$1`, [ctx.orgId]);
    const oldest = await query(`select min(created_at) as t from siem_outbox where org_id=$1`, [ctx.orgId]);
    const worst = await query(`select max(tries)::int as t from siem_outbox where org_id=$1`, [ctx.orgId]);

    const lastRun = await query(
      `select ran_at, sent, failed, duration_ms, notes
       from siem_runs where org_id=$1 order by ran_at desc limit 1`,
      [ctx.orgId]
    );

    const lastAlert = await query(
      `select sent_at, alert_type, status, last_error
       from siem_alert_events where org_id=$1 order by sent_at desc limit 1`,
      [ctx.orgId]
    );

    const metrics = [
      { k:"config_enabled", v: cfg.rows.length ? cfg.rows[0].enabled : false },
      { k:"provider", v: cfg.rows.length ? cfg.rows[0].provider : "" },
      { k:"endpoint", v: cfg.rows.length ? cfg.rows[0].endpoint : "" },
      { k:"pending_outbox", v: outCount.rows[0].c },
      { k:"oldest_pending", v: oldest.rows[0].t || "" },
      { k:"max_tries", v: worst.rows[0].t || 0 }
    ];

    const ok = true;
    const summary = "SIEM stats loaded.";

    return json(200, {
      ok,
      summary,
      outbox_metrics: metrics,
      last_run: lastRun.rows.length ? lastRun.rows[0] : null,
      last_alert: lastAlert.rows.length ? lastAlert.rows[0] : null
    });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
