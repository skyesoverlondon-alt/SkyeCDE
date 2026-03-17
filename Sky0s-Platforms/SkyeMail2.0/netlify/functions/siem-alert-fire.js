const { query } = require("./_db");
const { json, requireMethod, requireCsrf, requireEnv } = require("./_utils");
const { getOrgContext, requireAdmin } = require("./_orgauth");
const { kmsDecryptFromB64 } = require("./_kms");

async function sendWebhook(url, kind, payload){
  const headers = { "Content-Type":"application/json" };
  let body = payload;
  if(kind === "slack"){
    body = { text: payload.title + "\n" + payload.message };
  }else if(kind === "teams"){
    body = { text: payload.title + "\n" + payload.message };
  }
  const res = await fetch(url, { method:"POST", headers, body: JSON.stringify(body) });
  if(!res.ok) throw new Error("Webhook error: " + res.status);
}

async function sendEmail(to, subject, html){
  const key = requireEnv("RESEND_API_KEY");
  const from = requireEnv("NOTIFY_FROM_EMAIL");
  const res = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{ "Authorization": `Bearer ${key}`, "Content-Type":"application/json" },
    body: JSON.stringify({ from, to, subject, html })
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error("Email send failed: " + t);
  }
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    requireCsrf(event);

    const ctx = await getOrgContext(event);
    requireAdmin(ctx.role);

    const c = await query(
      `select enabled, webhook_kind, webhook_url_enc, email_to
       from siem_alert_configs where org_id=$1 limit 1`,
      [ctx.orgId]
    );
    if(!c.rows.length || !c.rows[0].enabled){
      return json(200, { ok:true, sent:false, note:"Alerting disabled." });
    }

    const row = c.rows[0];
    const payload = {
      title: "Skye Mail Vault SIEM alert test",
      message: `Test notification for org ${ctx.org.slug || ctx.orgId} at ${new Date().toISOString()}`,
      org: { id: ctx.orgId, slug: ctx.org.slug || null, name: ctx.org.name || null }
    };

    if(row.webhook_url_enc){
      const url = await kmsDecryptFromB64(row.webhook_url_enc);
      await sendWebhook(url, row.webhook_kind || "generic", payload);
    }
    if(row.email_to){
      await sendEmail(row.email_to, "Skye Mail Vault SIEM alert test", `<div style="font-family:Arial,sans-serif;line-height:1.5"><h3>${payload.title}</h3><p>${payload.message}</p></div>`);
    }

    await query(
      `insert into siem_alert_events(org_id, alert_type, payload_json, status)
       values($1,'siem_test',$2,'sent')`,
      [ctx.orgId, JSON.stringify(payload).slice(0,50000)]
    );

    return json(200, { ok:true, sent:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
