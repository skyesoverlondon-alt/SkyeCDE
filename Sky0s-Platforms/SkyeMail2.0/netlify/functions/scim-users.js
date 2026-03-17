const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf } = require("./_utils");
const { kmsEncryptToB64 } = require("./_kms");
const { applyUserPatchOps } = require("./_scim_patch");

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
    `select st.org_id, st.revoked_at, o.key_management_mode, o.kms_key_id
     from scim_tokens st join organizations o on o.id=st.org_id
     where st.token_hash=$1 limit 1`,
    [token_hash]
  );
  if(!r.rows.length || r.rows[0].revoked_at){
    const e=new Error("Unauthorized"); e.statusCode=401; throw e;
  }
  const org = r.rows[0];
  if(org.key_management_mode !== "kms"){
    const e=new Error("SCIM requires organization key_management_mode='kms'"); e.statusCode=409; throw e;
  }
  if(!org.kms_key_id){
    const e=new Error("Organization KMS key not configured"); e.statusCode=500; throw e;
  }
  return { org_id: org.org_id, kms_key_id: org.kms_key_id };
}

function scimUser(u){
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: u.id,
    userName: u.email,
    active: (u.is_active !== false),
    emails: [{ value: u.email, primary: true }],
    name: { formatted: u.handle },
    meta: { resourceType:"User" }
  };
}

function makeHandle(email){
  const base = String(email||"user").split("@")[0].replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase();
  return (base || "user").slice(0,24);
}

const cryptoNode = require("crypto");
function genKeypair(){
  const { publicKey, privateKey } = cryptoNode.generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type:"spki", format:"pem" },
    privateKeyEncoding: { type:"pkcs8", format:"pem" }
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

function parseResourceId(event){
  const path = String(event.path || "");
  const m = path.match(/\/scim\/v2\/Users\/([^\/]+)$/i);
  return m ? decodeURIComponent(m[1]) : "";
}

function parseJsonBody(event){
  try{
    return event.body ? JSON.parse(event.body) : {};
  }catch(e){
    const err = new Error("Invalid JSON");
    err.statusCode = 400;
    throw err;
  }
}

function extractEmail(body){
  const email = (body.userName || (body.emails && body.emails[0] && body.emails[0].value) || "").trim().toLowerCase();
  return email;
}

function applyPatchOps(body){
  const out = {};
  const ops = Array.isArray(body.Operations) ? body.Operations : [];
  for(const op of ops){
    const operation = String(op.op || op.operation || "").toLowerCase();
    const path = String(op.path || "").toLowerCase();
    const value = op.value;

    if(operation !== "add" && operation !== "replace" && operation !== "remove") continue;

    if(path === "active" || (path === "" && value && typeof value.active === "boolean")){
      const v = (path === "active") ? value : value.active;
      if(typeof v === "boolean") out.active = v;
    }

    if(path === "username" || path === "userName".toLowerCase() || (path === "" && value && typeof value.userName === "string")){
      const v = (path ? value : value.userName);
      if(typeof v === "string") out.email = String(v).trim().toLowerCase();
    }

    if(path.startsWith("emails") || (path === "" && value && Array.isArray(value.emails))){
      const arr = (path ? value : value.emails);
      if(Array.isArray(arr) && arr.length && arr[0] && arr[0].value){
        out.email = String(arr[0].value).trim().toLowerCase();
      }
    }
  }
  return out;
}

async function ensureUniqueEmail(email, userId){
  const r = await query(
    `select id from users where lower(email)=lower($1) and id<>$2 limit 1`,
    [email, userId]
  );
  if(r.rows.length){
    const err = new Error("Email already in use");
    err.statusCode = 409;
    throw err;
  }
}

exports.handler = async (event) => {
  try{
    const { org_id, kms_key_id } = await requireScim(event);

    const method = (event.httpMethod||"GET").toUpperCase();
    const id = parseResourceId(event);

    if(method === "GET"){
      // Support GET /Users/{id}
      if(id){
        const u = await query(
          `select id, handle, email, is_active from users where org_id=$1 and id=$2 limit 1`,
          [org_id, id]
        );
        if(!u.rows.length) return json(404, { error:"Not found" });
        return json(200, scimUser(u.rows[0]));
      }

      // Optional filter: userName eq "..."
      const qs = event.queryStringParameters || {};
      const filter = String(qs.filter || "");
      const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if(m){
        const email = String(m[1]).trim().toLowerCase();
        const u = await query(
          `select id, handle, email, is_active from users where org_id=$1 and lower(email)=lower($2) limit 1`,
          [org_id, email]
        );
        const resources = u.rows.map(scimUser);
        return json(200, {
          schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
          totalResults: resources.length,
          Resources: resources,
          startIndex: 1,
          itemsPerPage: resources.length
        });
      }

      const r = await query(
        `select id, handle, email, is_active from users where org_id=$1 order by created_at asc limit 200`,
        [org_id]
      );
      const resources = r.rows.map(scimUser);
      return json(200, {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: resources.length,
        Resources: resources,
        startIndex: 1,
        itemsPerPage: resources.length
      });
    }

    if(method === "POST"){
      const body = parseJsonBody(event);
      const email = extractEmail(body);
      if(!email || !email.includes("@")) return json(400,{ error:"Invalid userName/email" });

      // avoid duplicates
      const ex = await query(`select id from users where org_id=$1 and lower(email)=lower($2) limit 1`, [org_id, email]);
      if(ex.rows.length){
        const u = await query(`select id, handle, email, is_active from users where id=$1`, [ex.rows[0].id]);
        return json(201, scimUser(u.rows[0]));
      }

      // Create user with random password hash (SSO expected)
      const rand = crypto.randomBytes(24).toString("base64url");
      const password_hash = await bcrypt.hash(rand, 12);

      // unique handle
      let handle = makeHandle(email);
      for(let i=0;i<20;i++){
        const h = i===0 ? handle : (handle + "-" + crypto.randomBytes(2).toString("hex"));
        const c = await query(`select 1 from users where org_id=$1 and lower(handle)=lower($2) limit 1`, [org_id, h]);
        if(!c.rows.length){ handle=h; break; }
      }

      const ins = await query(
        `insert into users(handle, email, password_hash, org_id, is_active, email_verified, email_verified_at)
         values($1,$2,$3,$4,true,true,now()) returning id, handle, email, is_active`,
        [handle, email, password_hash, org_id]
      );
      const userId = ins.rows[0].id;

      // Org membership default viewer
      await query(
        `insert into org_members(org_id, user_id, role) values($1,$2,'viewer')
         on conflict(org_id,user_id) do nothing`,
        [org_id, userId]
      );

      // Provision KMS-wrapped keyring
      const kp = genKeypair();
      const wrapped = await kmsEncryptToB64(kp.privateKeyPem, kms_key_id);
      await query(
        `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json, kms_wrapped_private_key_b64)
         values($1,1,true,$2,$3,$4)`,
        [userId, kp.publicKeyPem, JSON.stringify({mode:"KMS"}), wrapped]
      );

      return json(201, scimUser(ins.rows[0]));
    }

    if(method === "PUT" || method === "PATCH"){
      if(!id) return json(400, { error:"Missing resource id in path" });

      const existing = await query(
        `select id, handle, email, is_active from users where org_id=$1 and id=$2 limit 1`,
        [org_id, id]
      );
      if(!existing.rows.length) return json(404, { error:"Not found" });

      const body = parseJsonBody(event);

      let updates = {};
      if(method === "PUT"){
        const email = extractEmail(body);
        if(email) updates.email = email;
        if(typeof body.active === "boolean") updates.active = body.active;
      }else{
        updates = applyUserPatchOps(body);
      }

      const email = updates.email ? String(updates.email).trim().toLowerCase() : null;
      const active = (typeof updates.active === "boolean") ? updates.active : null;

      if(email && (!email.includes("@"))) return json(400, { error:"Invalid email" });
      if(email) await ensureUniqueEmail(email, id);

      const newEmail = email || existing.rows[0].email;
      const newActive = (active === null) ? (existing.rows[0].is_active !== false) : active;

      const up = await query(
        `update users set email=$1, is_active=$2 where id=$3 and org_id=$4 returning id, handle, email, is_active`,
        [newEmail, newActive, id, org_id]
      );
      if(newActive === true){
        await query(`update users set disabled_at=null, disabled_reason=null where id=$1 and org_id=$2`, [id, org_id]);
      }


      // If deactivated, also downgrade org role to viewer (safe default)
      if(newActive === false){
        await query(
          `update org_members set role='viewer' where org_id=$1 and user_id=$2`,
          [org_id, id]
        );

        await query(
          `update users set disabled_at=now(), disabled_reason='scim_deprovision' where id=$1 and org_id=$2`,
          [id, org_id]
        );
        // Kill all existing sessions immediately
        await query(
          `update sessions set revoked_at=now(), revoke_reason='scim_deprovision' where user_id=$1 and revoked_at is null`,
          [id]
        );
      }

      return json(200, scimUser(up.rows[0]));
    }

    return json(405, { error:"Method not allowed" });

  }catch(err){
    const status=err.statusCode||500;
    return json(status,{ error: err.message || "Server error" });
  }
};


// Test hooks (no secrets)



// Test hooks (no secrets)
exports._test = { applyUserPatchOps, extractEmail };
