const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const BUILD_ID = process.env.BUILD_ID || "smv-procurement-v1.2.0";
const SCHEMA_VERSION = "1.2.0";

exports.handler = async () => {
  try{
    const r = await query("select 1 as ok");
    return json(200, { ok: true, db_ok: r.rows && r.rows[0] && r.rows[0].ok === 1, build_id: BUILD_ID, schema_version: SCHEMA_VERSION, time: new Date().toISOString() });
  }catch(e){
    return json(200, { ok: false, db_ok: false, build_id: BUILD_ID, schema_version: SCHEMA_VERSION, time: new Date().toISOString() });
  }
};
