const { query } = require("./_db");
const { json, requireMethod } = require("./_utils");
const { getOrgContext, requireAdmin } = require("./_orgauth");

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const ctx = await getOrgContext(event);
    requireAdmin(ctx.role);

    const r = await query(
      `select enabled, webhook_kind, (webhook_url_enc is not null and webhook_url_enc <> '') as has_webhook,
              email_to, threshold_failed, threshold_backlog, threshold_oldest_minutes, cooldown_minutes, notify_on_recovery,
              created_at, updated_at
       from siem_alert_configs where org_id=$1 limit 1`,
      [ctx.orgId]
    );

    return json(200, { ok:true, config: r.rows.length ? r.rows[0] : null });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
