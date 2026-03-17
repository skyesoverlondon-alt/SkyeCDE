const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf } = require("./_utils");
const { kmsDecryptFromB64 } = require("./_kms");

exports.handler = async (event) => {
  try{
    if((event.httpMethod||"GET").toUpperCase() !== "POST"){
      return json(405, { error: "Method not allowed" });
    }
    const auth = await verifyAuthSession(event);
    requireCsrf(event);

    const userId = auth.sub;

    const u = await query(
      `select u.org_id, o.key_management_mode
       from users u left join organizations o on o.id=u.org_id
       where u.id=$1 limit 1`,
      [userId]
    );
    if(!u.rows.length) return json(401, { error: "Unauthorized" });
    const mode = (u.rows[0].key_management_mode || "passphrase");

    if(mode !== "kms"){
      return json(400, { error: "Organization is not in KMS key management mode." });
    }

    const keys = await query(
      `select version, is_active, rsa_public_key_pem, kms_wrapped_private_key_b64, created_at
       from user_keys where user_id=$1 order by version asc`,
      [userId]
    );

    const out = [];
    for(const k of keys.rows){
      if(!k.kms_wrapped_private_key_b64) continue;
      const privPem = await kmsDecryptFromB64(k.kms_wrapped_private_key_b64);
      out.push({
        version: k.version,
        is_active: k.is_active,
        rsa_public_key_pem: k.rsa_public_key_pem,
        private_key_pem: privPem,
        created_at: k.created_at
      });
    }

    return json(200, { mode:"kms", keys: out });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
