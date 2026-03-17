const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");
const { recordAudit } = require("./_audit");

async function applyHold(orgId, scope, scopeId){
  if(scope === "org"){
    await query(
      `update messages set legal_hold=true
       where user_id in (select id from users where org_id=$1)`,
      [orgId]
    );
    return;
  }
  if(scope === "user"){
    await query(
      `update messages set legal_hold=true
       where user_id=$1`,
      [scopeId]
    );
    return;
  }
  if(scope === "thread"){
    await query(
      `update messages set legal_hold=true
       where thread_id=$1`,
      [scopeId]
    );
    return;
  }
  if(scope === "message"){
    await query(
      `update messages set legal_hold=true
       where id=$1`,
      [scopeId]
    );
    return;
  }
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405,{error:"Method not allowed"});
    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const { org } = await requireOrgRole(auth.sub, ["owner","admin"]);

    const body = parseJson(event);
    const scope = String(body.scope||"").trim();
    const scope_id = body.scope_id ? String(body.scope_id).trim() : null;
    const reason = body.reason ? String(body.reason).slice(0,500) : null;

    if(!["org","user","thread","message"].includes(scope)) return json(400,{error:"scope must be org|user|thread|message"});
    if(scope !== "org" && !scope_id) return json(400,{error:"scope_id required for non-org scopes"});

    const ins = await query(
      `insert into legal_holds(org_id, scope, scope_id, reason, created_by)
       values($1,$2,$3,$4,$5)
       returning id`,
      [org.id, scope, scope_id, reason, auth.sub]
    );
    await applyHold(org.id, scope, scope_id);

    await recordAudit(event, auth.sub, "legal_hold.set", "legal_hold", ins.rows[0].id, { scope, scope_id, reason });

    return json(200, { ok:true, id: ins.rows[0].id });

  }catch(err){
    const status=err.statusCode||500;
    return json(status,{error:err.message||"Server error"});
  }
};
