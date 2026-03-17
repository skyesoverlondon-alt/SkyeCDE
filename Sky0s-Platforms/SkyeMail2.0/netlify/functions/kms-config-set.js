const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");
const { recordAudit } = require("./_audit");

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405,{error:"Method not allowed"});
    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const { org } = await requireOrgRole(auth.sub, ["owner"]);

    const body = parseJson(event);
    const mode = String(body.key_management_mode || "passphrase");
    const kms_key_id = String(body.kms_key_id || "").trim();

    if(!["passphrase","kms"].includes(mode)) return json(400,{error:"key_management_mode must be passphrase|kms"});
    if(mode === "kms" && !kms_key_id) return json(400,{error:"kms_key_id required when mode=kms"});

    await query(
      `update organizations set key_management_mode=$2, kms_key_id=$3 where id=$1`,
      [org.id, mode, kms_key_id || null]
    );

    await recordAudit(event, auth.sub, "kms.config.set", "org", org.id, { mode });

    return json(200, { ok:true });
  }catch(err){
    const status=err.statusCode||500;
    return json(status,{error:err.message||"Server error"});
  }
};
