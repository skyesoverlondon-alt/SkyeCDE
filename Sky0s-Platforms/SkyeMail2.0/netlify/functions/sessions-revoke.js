const { json, parseJson, verifyAuthSession, requireCsrf, revokeSessionByJti, requireMethod} = require("./_utils");
const { recordAudit } = require("./_audit");

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405, { error:"Method not allowed" });
    requireCsrf(event);
    const auth = await verifyAuthSession(event, { touch:false });
    const body = parseJson(event);
    const jti = String(body.jti || "").trim();
    if(!jti) return json(400, { error:"jti required" });

    await revokeSessionByJti(auth.sub, jti, "user_revoked");
    await recordAudit(event, auth.sub, "SESSION_REVOKED", "session", jti, { jti });

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
