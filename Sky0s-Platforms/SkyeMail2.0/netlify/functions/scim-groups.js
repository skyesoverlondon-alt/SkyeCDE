const crypto = require("crypto");
const { query } = require("./_db");
const { applyGroupPatchOps, normalizeMembers } = require("./_scim_patch");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf } = require("./_utils");
function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

function getBearer(event){
  const h = event.headers && (event.headers.authorization || event.headers.Authorization);
  if(!h) return "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

async function requireScim(event){
  const token = getBearer(event);
  if(!token) { const e=new Error("Unauthorized"); e.statusCode=401; throw e; }
  const token_hash = sha256Hex(token);
  const r = await query(
    `select st.org_id, st.revoked_at from scim_tokens st where st.token_hash=$1 limit 1`,
    [token_hash]
  );
  if(!r.rows.length || r.rows[0].revoked_at){
    const e=new Error("Unauthorized"); e.statusCode=401; throw e;
  }
  return { org_id: r.rows[0].org_id };
}

function scimGroup(g, members){
  const obj = {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    id: g.id,
    displayName: g.display_name,
    meta: { resourceType:"Group" }
  };
  if(members){
    obj.members = members;
  }
  return obj;
}

async function ensureDefaultGroups(orgId){
  const names = ["Admins","Viewers"];
  for(const n of names){
    await query(
      `insert into scim_groups(org_id, display_name) values($1,$2)
       on conflict(org_id, display_name) do nothing`,
      [orgId, n]
    );
  }
}

function parseResourceId(event){
  const path = String(event.path || "");
  const m = path.match(/\/scim\/v2\/Groups\/([^\/]+)$/i);
  return m ? decodeURIComponent(m[1]) : "";
}

function parseJsonBody(event){
  try{ return event.body ? JSON.parse(event.body) : {}; }catch(e){
    const err = new Error("Invalid JSON");
    err.statusCode = 400;
    throw err;
  }
}


async function getMembers(groupId){
  const r = await query(
    `select u.id, u.email
     from scim_group_members gm join users u on u.id=gm.user_id
     where gm.group_id=$1
     order by u.email asc`,
    [groupId]
  );
  return r.rows.map(x => ({ value: x.id, display: x.email }));
}

async function recomputeOrgRole(orgId, userId){
  // If user is in Admins group => admin, else viewer.
  const g = await query(
    `select sg.display_name
     from scim_group_members gm
     join scim_groups sg on sg.id=gm.group_id
     where sg.org_id=$1 and gm.user_id=$2`,
    [orgId, userId]
  );
  const names = new Set(g.rows.map(r => String(r.display_name || "").toLowerCase()));
  const role = names.has("admins") ? "admin" : "viewer";
  await query(
    `insert into org_members(org_id, user_id, role)
     values($1,$2,$3)
     on conflict(org_id,user_id) do update set role=excluded.role`,
    [orgId, userId, role]
  );
}


exports.handler = async (event) => {
  try{
    const { org_id } = await requireScim(event);
    await ensureDefaultGroups(org_id);

    const method = (event.httpMethod||"GET").toUpperCase();
    const id = parseResourceId(event);

    if(method === "GET"){
      if(id){
        const g = await query(`select id, display_name from scim_groups where org_id=$1 and id=$2 limit 1`, [org_id, id]);
        if(!g.rows.length) return json(404, { error:"Not found" });
        const members = await getMembers(id);
        return json(200, scimGroup(g.rows[0], members));
      }
      const g = await query(`select id, display_name from scim_groups where org_id=$1 order by display_name asc`, [org_id]);
      const resources = g.rows.map(x => scimGroup(x));
      return json(200, {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: resources.length,
        Resources: resources
      });
    }

    if(method === "PUT"){
      if(!id) return json(400, { error:"Missing resource id in path" });
      const g = await query(`select id, display_name from scim_groups where org_id=$1 and id=$2 limit 1`, [org_id, id]);
      if(!g.rows.length) return json(404, { error:"Not found" });
      const body = parseJsonBody(event);
      const members = normalizeMembers(body.members || []);
      // replace membership set
      await query(`delete from scim_group_members where group_id=$1`, [id]);
      for(const uid of members){
        await query(`insert into scim_group_members(group_id, user_id) values($1,$2) on conflict do nothing`, [id, uid]);
        await recomputeOrgRole(org_id, uid);
      }
      const outMembers = await getMembers(id);
      return json(200, scimGroup(g.rows[0], outMembers));
    }

    if(method === "PATCH"){
      if(!id) return json(400, { error:"Missing resource id in path" });
      const g = await query(`select id, display_name from scim_groups where org_id=$1 and id=$2 limit 1`, [org_id, id]);
      if(!g.rows.length) return json(404, { error:"Not found" });
      const body = parseJsonBody(event);

      const { add, remove } = applyGroupPatchOps(body);
      for(const uid of remove){
        await query(`delete from scim_group_members where group_id=$1 and user_id=$2`, [id, uid]);
        await recomputeOrgRole(org_id, uid);
      }
      for(const uid of add){
        await query(`insert into scim_group_members(group_id, user_id) values($1,$2) on conflict do nothing`, [id, uid]);
        await recomputeOrgRole(org_id, uid);
      }

      const outMembers = await getMembers(id);
      return json(200, scimGroup(g.rows[0], outMembers));
    }

    return json(405, { error:"Method not allowed" });

  }catch(err){
    const status=err.statusCode||500;
    return json(status,{ error: err.message || "Server error" });
  }
};


// Test hooks (no secrets)



// Test hooks (no secrets)
exports._test = { applyGroupPatchOps, normalizeMembers };
