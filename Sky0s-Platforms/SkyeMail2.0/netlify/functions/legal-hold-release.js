const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");
const { recordAudit } = require("./_audit");

async function recomputeOrgLegalHold(orgId){
  // Reset all flags
  await query(
    `update messages set legal_hold=false
     where user_id in (select id from users where org_id=$1)`,
    [orgId]
  );

  const holds = await query(
    `select scope, scope_id from legal_holds where org_id=$1 and released_at is null`,
    [orgId]
  );

  for(const h of holds.rows){
    const scope=h.scope;
    const sid=h.scope_id;
    if(scope === "org"){
      await query(
        `update messages set legal_hold=true
         where user_id in (select id from users where org_id=$1)`,
        [orgId]
      );
    }else if(scope === "user"){
      await query(`update messages set legal_hold=true where user_id=$1`, [sid]);
    }else if(scope === "thread"){
      await query(`update messages set legal_hold=true where thread_id=$1`, [sid]);
    }else if(scope === "message"){
      await query(`update messages set legal_hold=true where id=$1`, [sid]);
    }
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
    const id = String(body.id||"").trim();
    if(!id) return json(400,{error:"id required"});

    await query(
      `update legal_holds set released_at=now() where id=$1 and org_id=$2`,
      [id, org.id]
    );

    await recomputeOrgLegalHold(org.id);

    await recordAudit(event, auth.sub, "legal_hold.release", "legal_hold", id, null);

    return json(200, { ok:true });

  }catch(err){
    const status=err.statusCode||500;
    return json(status,{error:err.message||"Server error"});
  }
};
