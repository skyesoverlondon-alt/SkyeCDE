const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
// Public-safe DLP policy snapshot for client-side pre-checks.
// Does NOT reveal full regexes if you don't want it to; here we only return action and keyword list.
exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const qs = event.queryStringParameters || {};
    const handle = String(qs.handle || "").trim();
    if(!handle) return json(200, { action:"off", keywords:[] });

    const u = await query(`select org_id from users where lower(handle)=lower($1) limit 1`, [handle]);
    if(!u.rows.length) return json(200, { action:"off", keywords:[] });

    const orgId = u.rows[0].org_id;
    if(!orgId) return json(200, { action:"off", keywords:[] });

    const p = await query(`select action, patterns_json from dlp_policies where org_id=$1 limit 1`, [orgId]);
    if(!p.rows.length) return json(200, { action:"off", keywords:[] });

    const action = p.rows[0].action || "off";
    let patterns = [];
    try{ patterns = JSON.parse(p.rows[0].patterns_json || "[]"); }catch(e){ patterns=[]; }

    const keywords = (Array.isArray(patterns)?patterns:[])
      .filter(x => x && x.type === "keyword" && x.value)
      .map(x => String(x.value).slice(0, 64))
      .slice(0, 50);

    return json(200, { action, keywords });
  }catch(err){
    return json(200, { action:"off", keywords:[] });
  }
};
