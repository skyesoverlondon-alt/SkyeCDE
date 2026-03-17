const { query } = require("./_db");
const { json, parseJson, requireMethod, requireCsrf } = require("./_utils");
const { getOrgContext, requireAdmin } = require("./_orgauth");
const { kmsEncryptToB64, configKmsKeyId } = require("./_kms");

function clampInt(v, min, max, def){
  const n = Number(v);
  if(!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    requireCsrf(event);

    const ctx = await getOrgContext(event);
    requireAdmin(ctx.role);

    const body = parseJson(event);
    const enabled = !!body.enabled;
    const webhook_kind = String(body.webhook_kind || "generic").trim().toLowerCase();
    const webhook_url = String(body.webhook_url || "").trim();
    const email_to = String(body.email_to || "").trim() || null;

    const threshold_failed = clampInt(body.threshold_failed, 1, 1000, 5);
    const threshold_backlog = clampInt(body.threshold_backlog, 1, 200000, 200);
    const threshold_oldest_minutes = clampInt(body.threshold_oldest_minutes, 1, 1440, 30);
    const cooldown_minutes = clampInt(body.cooldown_minutes, 1, 1440, 60);
    const notify_on_recovery = !!body.notify_on_recovery;

    let webhook_url_enc = null;
    if(webhook_url){
      if(!/^https:\/\//i.test(webhook_url)) return json(400, { error:"webhook_url must be https://" });
      webhook_url_enc = await kmsEncryptToB64(webhook_url, configKmsKeyId());
    }

    await query(
      `insert into siem_alert_configs(org_id, enabled, webhook_kind, webhook_url_enc, email_to,
                                     threshold_failed, threshold_backlog, threshold_oldest_minutes, cooldown_minutes, notify_on_recovery)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict(org_id) do update set
         enabled=excluded.enabled,
         webhook_kind=excluded.webhook_kind,
         webhook_url_enc=coalesce(excluded.webhook_url_enc, siem_alert_configs.webhook_url_enc),
         email_to=excluded.email_to,
         threshold_failed=excluded.threshold_failed,
         threshold_backlog=excluded.threshold_backlog,
         threshold_oldest_minutes=excluded.threshold_oldest_minutes,
         cooldown_minutes=excluded.cooldown_minutes,
         notify_on_recovery=excluded.notify_on_recovery,
         updated_at=now()`,
      [ctx.orgId, enabled, webhook_kind, webhook_url_enc || "", email_to, threshold_failed, threshold_backlog, threshold_oldest_minutes, cooldown_minutes, notify_on_recovery]
    );

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
