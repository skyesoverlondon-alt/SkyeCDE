exports.config = { schedule: "@daily" };

const { query } = require("./_db");

// Minimal JSON responder
function json(statusCode, body){
  return {
    statusCode,
    headers: { "Content-Type":"application/json", "Cache-Control":"no-store" },
    body: JSON.stringify(body)
  };
}

exports.handler = async () => {
  // Purge routine for Fortune-500 hygiene: keep tables bounded and honor retention_policies.
  const out = {
    ok: true,
    purged_messages: 0,
    purged_rate_events: 0,
    purged_sessions: 0,
    purged_dlp_events: 0,
    purged_siem_outbox: 0
  };

  // 1) Message retention: per-org retention_policies.message_retain_days (0 means "keep forever")
  // Only delete messages not on legal hold.
  const msg = await query(
    `with doomed as (
       select m.id
       from messages m
       join users u on u.id = m.user_id
       join retention_policies rp on rp.org_id = u.org_id
       where rp.message_retain_days > 0
         and m.created_at < now() - (rp.message_retain_days || ' days')::interval
         and coalesce(m.legal_hold,false) = false
     )
     delete from messages where id in (select id from doomed)
     returning id`,
    []
  );
  out.purged_messages = msg.rowCount || 0;

  // 2) Rate events retention: keep last 30 days
  const r = await query(
    `delete from rate_events where created_at < now() - interval '30 days'`,
    []
  );
  out.purged_rate_events = r.rowCount || 0;

  // 3) Sessions retention: delete revoked/expired sessions older than 30 days (keeps active sessions)
  const s = await query(
    `delete from sessions
     where (revoked_at is not null or expires_at < now())
       and created_at < now() - interval '30 days'`,
    []
  );
  out.purged_sessions = s.rowCount || 0;

  // 4) DLP events retention: keep last 365 days (can be tightened per customer)
  const d = await query(
    `delete from dlp_events where created_at < now() - interval '365 days'`,
    []
  );
  out.purged_dlp_events = d.rowCount || 0;

  // 5) SIEM outbox hygiene: delete very old stuck items (90 days) after many tries
  const o = await query(
    `delete from siem_outbox
     where created_at < now() - interval '90 days'
       and tries >= 20`,
    []
  );
  out.purged_siem_outbox = o.rowCount || 0;

  return json(200, out);
};
