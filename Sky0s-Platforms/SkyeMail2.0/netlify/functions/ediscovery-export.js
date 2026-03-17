const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");

exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const { org } = await requireOrgRole(auth.sub, ["owner","admin"]);

    const qs = event.queryStringParameters || {};
    const type = String(qs.type || "messages");
    const limit = Math.max(1, Math.min(200, Number(qs.limit || 200)));
    const offset = Math.max(0, Number(qs.offset || 0));
    const include_deleted = String(qs.include_deleted||"false") === "true";

    if(type === "audit"){
      const r = await query(
        `select id, org_id, actor_user_id, action, target_type, target_id, ip_hash, user_agent, meta_json, created_at
         from audit_events
         where org_id=$1
         order by id desc
         limit ${limit} offset ${offset}`,
        [org.id]
      );
      return json(200, { type:"audit", items:r.rows, next_offset: offset + r.rows.length });
    }

    // messages (ciphertext + metadata)
    const whereDel = include_deleted ? "" : "and m.deleted_at is null";
    const r = await query(
      `select m.id, m.user_id, m.thread_id, m.from_name, m.from_email, m.key_version,
              m.encrypted_key_b64, m.iv_b64, m.ciphertext_b64,
              m.created_at, m.read_at, m.deleted_at, m.legal_hold,
              (select count(*)::int from attachments a where a.message_id=m.id) as attachment_count
       from messages m
       join users u on u.id=m.user_id
       where u.org_id=$1 ${whereDel}
       order by m.created_at desc
       limit ${limit} offset ${offset}`,
      [org.id]
    );

    return json(200, { type:"messages", items:r.rows, next_offset: offset + r.rows.length });

  }catch(err){
    const status=err.statusCode||500;
    return json(status,{error:err.message||"Server error"});
  }
};
