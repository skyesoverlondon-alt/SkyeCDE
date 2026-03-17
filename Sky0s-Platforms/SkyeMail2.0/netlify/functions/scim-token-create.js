const crypto = require("crypto");
const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");
const { recordAudit } = require("./_audit");

function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}


exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405,{error:"Method not allowed"});
    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const { org } = await requireOrgRole(auth.sub, ["owner"]);

    const token = randomToken(32);
    const token_hash = sha256Hex(token);

    await query(
      `insert into scim_tokens(org_id, token_hash, created_by) values($1,$2,$3)`,
      [org.id, token_hash, auth.sub]
    );

    await recordAudit(event, auth.sub, "scim.token.create", "org", org.id, null);

    return json(200, { ok:true, token }); // only time token is shown
  }catch(err){
    const status=err.statusCode||500;
    return json(status,{error:err.message||"Server error"});
  }
};
