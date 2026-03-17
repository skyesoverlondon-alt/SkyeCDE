exports.config = { schedule: "@every 5m" };

// Minimal JSON responder (keeps tests runnable without installing full deps)
function json(statusCode, body){
  return {
    statusCode,
    headers: { "Content-Type":"application/json", "Cache-Control":"no-store" },
    body: JSON.stringify(body)
  };
}

let __deps = null;
function deps(){
  if(__deps) return __deps;
  const { query } = require("./_db");
  const { kmsDecryptFromB64 } = require("./_kms");
  __deps = { query, kmsDecryptFromB64 };
  return __deps;
}

async function sendToSplunk(fetchFn, endpoint, token, payload){
  const res = await fetchFn(endpoint, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": `Splunk ${token}`
    },
    body: JSON.stringify({ event: payload })
  });
  if(!res.ok) throw new Error("Splunk HEC error: " + res.status);
}

async function sendToDatadog(fetchFn, endpoint, token, payload){
  const res = await fetchFn(endpoint, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "DD-API-KEY": token
    },
    body: JSON.stringify([payload])
  });
  if(!res.ok) throw new Error("Datadog logs error: " + res.status);
}

async function sendWebhook(fetchFn, url, kind, payload){
  const headers = { "Content-Type":"application/json" };
  let body = payload;
  if(kind === "slack"){
    body = { text: payload.title + "\n" + payload.message };
  }else if(kind === "teams"){
    body = { text: payload.title + "\n" + payload.message };
  }
  const res = await fetchFn(url, { method:"POST", headers, body: JSON.stringify(body) });
  if(!res.ok) throw new Error("Webhook error: " + res.status);
}

async function loadAlertConfig(q, orgId){
  const r = await q(
    `select enabled, webhook_kind, webhook_url_enc, email_to,
            threshold_failed, threshold_backlog, threshold_oldest_minutes, cooldown_minutes, notify_on_recovery
     from siem_alert_configs where org_id=$1 limit 1`,
    [orgId]
  );
  return r.rows.length ? r.rows[0] : null;
}

async function shouldCooldown(q, orgId, alertType, cooldownMinutes){
  const r = await q(
    `select sent_at from siem_alert_events
     where org_id=$1 and alert_type=$2
     order by sent_at desc limit 1`,
    [orgId, alertType]
  );
  if(!r.rows.length) return false;
  const last = new Date(r.rows[0].sent_at).getTime();
  return (Date.now() - last) < (Number(cooldownMinutes||60) * 60 * 1000);
}

/**
 * Drain outbox once. Injectable dependencies for tests.
 */
async function drainOnce({ queryFn, kmsDecrypt, fetchFn=fetch, limit=50 } = {}){
  const t0 = Date.now();
  const d = (!queryFn || !kmsDecrypt) ? deps() : null;
  const q = queryFn || d.query;
  const dec = kmsDecrypt || d.kmsDecryptFromB64;

  const batch = await q(
    `select id, org_id, provider, endpoint, token_enc, payload_json, tries
     from siem_outbox
     where next_attempt_at <= now()
     order by id asc
     limit ${Number(limit)||50}`,
    []
  );

  // per-org aggregates
  const agg = new Map(); // org_id -> {sent, failed}
  function bump(orgId, k){
    const id = String(orgId||"");
    if(!agg.has(id)) agg.set(id, { sent:0, failed:0 });
    agg.get(id)[k] += 1;
  }

  let sentTotal = 0, failedTotal = 0;

  for(const row of batch.rows){
    try{
      const token = await dec(row.token_enc);
      const payload = JSON.parse(row.payload_json);

      if(row.provider === "splunk"){
        await sendToSplunk(fetchFn, row.endpoint, token, payload);
      }else{
        await sendToDatadog(fetchFn, row.endpoint, token, payload);
      }

      await q(`delete from siem_outbox where id=$1`, [row.id]);
      sentTotal++;
      bump(row.org_id, "sent");
    }catch(e){
      failedTotal++;
      bump(row.org_id, "failed");
      const tries = (row.tries || 0) + 1;
      const backoffMin = Math.min(60, Math.pow(2, Math.min(tries, 6))); // up to 64 min
      await q(
        `update siem_outbox
         set tries=$2,
             last_error=$3,
             next_attempt_at=now() + ($4 || ' minutes')::interval
         where id=$1`,
        [row.id, tries, String(e.message||e).slice(0,400), backoffMin]
      );
    }
  }

  // Record per-org runs + alerting
  for(const [orgId, a] of agg.entries()){
    if(!orgId) continue;

    const duration = Date.now() - t0;
    await q(
      `insert into siem_runs(org_id, sent, failed, duration_ms, notes)
       values($1,$2,$3,$4,$5)`,
      [orgId, a.sent, a.failed, duration, `batch_size=${batch.rows.length}`]
    );

    const cfg = await loadAlertConfig(q, orgId);
    if(!cfg || !cfg.enabled) continue;

    const backlog = await q(`select count(*)::int as c from siem_outbox where org_id=$1`, [orgId]);
    const oldest = await q(`select min(created_at) as t from siem_outbox where org_id=$1`, [orgId]);

    const backlogCount = backlog.rows[0].c;
    const oldestAt = oldest.rows[0].t ? new Date(oldest.rows[0].t).getTime() : null;
    const oldestMin = oldestAt ? Math.floor((Date.now() - oldestAt)/60000) : 0;

    const trigger = (a.failed >= (cfg.threshold_failed||5)) ||
                    (backlogCount >= (cfg.threshold_backlog||200)) ||
                    (oldestAt && oldestMin >= (cfg.threshold_oldest_minutes||30));

    const cooldown = Number(cfg.cooldown_minutes||60);

    if(trigger){
      const inCooldown = await shouldCooldown(q, orgId, "siem_delivery", cooldown);
      if(!inCooldown){
        try{
          let webhookUrl = null;
          if(cfg.webhook_url_enc){
            webhookUrl = await dec(cfg.webhook_url_enc);
          }
          const payload = {
            title: "SIEM delivery alert",
            message: `SIEM drain issues detected. failed=${a.failed}, backlog=${backlogCount}, oldest_min=${oldestMin}`,
            org_id: orgId,
            metrics: { run_failed: a.failed, run_sent: a.sent, backlog: backlogCount, oldest_minutes: oldestMin },
            at: new Date().toISOString()
          };
          if(webhookUrl){
            await sendWebhook(fetchFn, webhookUrl, cfg.webhook_kind || "generic", payload);
          }
          if(cfg.email_to){
            // best-effort: email via Resend if configured; if not, ignore
            const { requireEnv } = require("./_utils");
            const key = process.env.RESEND_API_KEY;
            const from = process.env.NOTIFY_FROM_EMAIL;
            if(key && from){
              await fetchFn("https://api.resend.com/emails", {
                method:"POST",
                headers:{ "Authorization": `Bearer ${key}`, "Content-Type":"application/json" },
                body: JSON.stringify({ from, to: cfg.email_to, subject: "Skye Mail Vault SIEM delivery alert", html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h3>${payload.title}</h3><p>${payload.message}</p></div>` })
              });
            }
          }
          await q(
            `insert into siem_alert_events(org_id, alert_type, payload_json, status)
             values($1,'siem_delivery',$2,'sent')`,
            [orgId, JSON.stringify(payload).slice(0,50000)]
          );
        }catch(e){
          await q(
            `insert into siem_alert_events(org_id, alert_type, payload_json, status, last_error)
             values($1,'siem_delivery',$2,'failed',$3)`,
            [orgId, JSON.stringify({ error: String(e.message||e) }).slice(0,50000), String(e.message||e).slice(0,400)]
          );
        }
      }
    }else if(cfg.notify_on_recovery){
      // Recovery notice if we previously alerted recently
      const hadRecent = await shouldCooldown(q, orgId, "siem_delivery", 24*60); // 24h lookback
      if(hadRecent){
        const inCooldown = await shouldCooldown(q, orgId, "siem_recovered", cooldown);
        if(!inCooldown){
          try{
            let webhookUrl = null;
            if(cfg.webhook_url_enc){
              webhookUrl = await dec(cfg.webhook_url_enc);
            }
            const payload = {
              title: "SIEM delivery recovered",
              message: `SIEM drain appears healthy now. failed=${a.failed}, backlog=${backlogCount}, oldest_min=${oldestMin}`,
              org_id: orgId,
              metrics: { run_failed: a.failed, run_sent: a.sent, backlog: backlogCount, oldest_minutes: oldestMin },
              at: new Date().toISOString()
            };
            if(webhookUrl){
              await sendWebhook(fetchFn, webhookUrl, cfg.webhook_kind || "generic", payload);
            }
            await q(
              `insert into siem_alert_events(org_id, alert_type, payload_json, status)
               values($1,'siem_recovered',$2,'sent')`,
              [orgId, JSON.stringify(payload).slice(0,50000)]
            );
          }catch(e){
            await q(
              `insert into siem_alert_events(org_id, alert_type, payload_json, status, last_error)
               values($1,'siem_recovered',$2,'failed',$3)`,
              [orgId, JSON.stringify({ error: String(e.message||e) }).slice(0,50000), String(e.message||e).slice(0,400)]
            );
          }
        }
      }
    }
  }

  return { ok:true, sent: sentTotal, failed: failedTotal, orgs: agg.size, duration_ms: Date.now()-t0 };
}

exports.drainOnce = drainOnce;

exports.handler = async () => {
  const out = await drainOnce();
  return json(200, out);
};
