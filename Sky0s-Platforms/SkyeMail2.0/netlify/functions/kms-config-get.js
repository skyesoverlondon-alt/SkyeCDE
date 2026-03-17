const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");

exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const { org } = await requireOrgRole(auth.sub, ["owner","admin"]);
    const r = await query(`select key_management_mode, kms_key_id from organizations where id=$1`, [org.id]);
    const row = r.rows.length ? r.rows[0] : { key_management_mode:"passphrase", kms_key_id:null };
    return json(200, { key_management_mode: row.key_management_mode, kms_key_id: row.kms_key_id || "" });
  }catch(err){
    const status=err.statusCode||500;
    return json(status,{error:err.message||"Server error"});
  }
};
