const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const ures = await query(
      `select u.handle, u.email, u.org_id, u.recovery_enabled, u.email_verified, u.last_login_at,
              o.key_management_mode, o.kms_key_id
       from users u
       left join organizations o on o.id=u.org_id
       where u.id=$1 limit 1`,
      [userId]
    );
    if(!ures.rows.length) return json(401, { error: "Unauthorized" });

    const kres = await query(
      `select version, is_active, rsa_public_key_pem, vault_wrap_json, created_at
       from user_keys
       where user_id=$1
       order by version asc`,
      [userId]
    );

    const keys = kres.rows;
    const active = keys.find(k => k.is_active) || null;

    let org_role = null;
    if(ures.rows[0].org_id){
      const r = await query(`select role from org_members where org_id=$1 and user_id=$2 limit 1`, [ures.rows[0].org_id, userId]);
      org_role = r.rows.length ? r.rows[0].role : null;
    }

    return json(200, {
      handle: ures.rows[0].handle,
      email: ures.rows[0].email,
      org_id: ures.rows[0].org_id,
      org_role,
      org_key_management_mode: ures.rows[0].key_management_mode || "passphrase",
      org_kms_key_id: ures.rows[0].kms_key_id || null,
      email_verified: !!ures.rows[0].email_verified,
      last_login_at: ures.rows[0].last_login_at,
      recovery_enabled: ures.rows[0].recovery_enabled,
      keys,
      active_version: active ? active.version : null
    });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
