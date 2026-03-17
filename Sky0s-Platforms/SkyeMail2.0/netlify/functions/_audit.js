const { query } = require("./_db");
const crypto = require("crypto");
const { getClientIp } = require("./_utils");
const { enqueueSiem } = require("./_siem");

function hashIpSafe(ip){
  const salt = process.env.IP_HASH_SALT ? String(process.env.IP_HASH_SALT) : "";
  const material = salt ? (String(ip) + "|" + salt) : String(ip);
  return crypto.createHash("sha256").update(material).digest("hex");
}

async function recordAudit(event, actorUserId, action, targetType = null, targetId = null, metaObj = null, orgIdOverride = null){
  try{
    const ip = getClientIp(event);
    const ip_hash = hashIpSafe(ip);
    const ua = (event.headers && (event.headers["user-agent"] || event.headers["User-Agent"])) ? String(event.headers["user-agent"] || event.headers["User-Agent"]) : "";

    let org_id = orgIdOverride || null;
    if(!org_id && actorUserId){
      const r = await query("select org_id from users where id=$1 limit 1", [actorUserId]);
      org_id = r.rows.length ? r.rows[0].org_id : null;
    }

    const meta_json = metaObj ? JSON.stringify(metaObj).slice(0, 20000) : null;

    const ins = await query(
      `insert into audit_events(org_id, actor_user_id, action, target_type, target_id, ip_hash, user_agent, meta_json)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, created_at`,
      [org_id, actorUserId || null, action, targetType, targetId, ip_hash, ua.slice(0, 300), meta_json]
    );

    const row = ins.rows[0];
    await enqueueSiem(org_id, {
      audit_id: row.id,
      org_id,
      actor_user_id: actorUserId || null,
      action,
      target_type: targetType,
      target_id: targetId,
      ip_hash,
      user_agent: ua.slice(0, 300),
      meta: metaObj || null,
      created_at: row.created_at
    });

  }catch(e){
    // never block core
  }
}

module.exports = { recordAudit };
