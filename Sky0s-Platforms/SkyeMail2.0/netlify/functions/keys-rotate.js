const crypto = require("crypto");
const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { kmsEncryptToB64 } = require("./_kms");

function genKeypair(){
  // 3072-bit RSA (enterprise-friendly)
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST"){
      return json(405, { error: "Method not allowed" });
    }

    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const userId = auth.sub;
    const body = parseJson(event);

    const u = await query(
      `select u.org_id, o.key_management_mode, o.kms_key_id
       from users u left join organizations o on o.id=u.org_id
       where u.id=$1 limit 1`,
      [userId]
    );
    const mode = u.rows.length ? (u.rows[0].key_management_mode || "passphrase") : "passphrase";
    const kmsKeyId = u.rows.length ? (u.rows[0].kms_key_id || "") : "";

    let rsa_public_key_pem = body.rsa_public_key_pem;
    let vault_wrap_json = body.vault_wrap_json;
    let kms_wrapped_private_key_b64 = null;

    if(mode === "kms"){
      if(!kmsKeyId) return json(500, { error: "Organization KMS key is not configured (organizations.kms_key_id)." });
      const kp = genKeypair();
      rsa_public_key_pem = kp.publicKeyPem;
      kms_wrapped_private_key_b64 = await kmsEncryptToB64(kp.privateKeyPem, kmsKeyId);
      vault_wrap_json = JSON.stringify({ mode:"KMS" });
    }else{
      if(!rsa_public_key_pem || !rsa_public_key_pem.includes("BEGIN PUBLIC KEY")) return json(400, { error: "rsa_public_key_pem required (PEM)." });
      if(!vault_wrap_json) return json(400, { error: "vault_wrap_json required." });
    }

    const cur = await query(`select coalesce(max(version),0) as maxv from user_keys where user_id=$1`, [userId]);
    const nextV = Number(cur.rows[0].maxv) + 1;

    await query(`update user_keys set is_active=false where user_id=$1`, [userId]);
    await query(
      `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json, kms_wrapped_private_key_b64)
       values($1,$2,true,$3,$4,$5)`,
      [userId, nextV, rsa_public_key_pem, vault_wrap_json, kms_wrapped_private_key_b64]
    );

    await recordAudit(event, userId, "keys.rotate", "user", userId, { mode, version: nextV });

    return json(200, { ok:true, active_version: nextV, mode });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
