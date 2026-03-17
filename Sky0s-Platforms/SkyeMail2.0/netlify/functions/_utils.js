const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { query } = require("./_db");

function json(statusCode, body, extraHeaders = {}){
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function jsonCookies(statusCode, body, cookies = [], extraHeaders = {}){
  const resp = json(statusCode, body, extraHeaders);
  if(cookies && cookies.length){
    resp.multiValueHeaders = resp.multiValueHeaders || {};
    resp.multiValueHeaders["Set-Cookie"] = cookies;
  }
  return resp;
}

function requireEnv(name){
  const v = process.env[name];
  if(!v) throw new Error(`${name} env var missing.`);
  return v;
}


function requireMethod(event, allowed){
  const m = String(event.httpMethod || "GET").toUpperCase();
  const arr = Array.isArray(allowed) ? allowed.map(x => String(x).toUpperCase()) : [String(allowed).toUpperCase()];
  if(!arr.includes(m)){
    const err = new Error("Method not allowed");
    err.statusCode = 405;
    throw err;
  }
  return m;
}

function requireOriginForCookieAuth(event){
  const cookies = parseCookies(event);
  if(!cookies.SMV_AUTH) return; // only enforce for browser cookie auth
  const method = String(event.httpMethod || "GET").toUpperCase();
  if(method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const h = event.headers || {};
  const origin = h.origin || h.Origin || "";
  const referer = h.referer || h.Referer || "";
  const base = getSiteUrl() || "";

  // If base isn't known, skip (dev environments)
  if(!base) return;

  const ok = (origin && String(origin).startsWith(base)) || (referer && String(referer).startsWith(base));
  if(!ok){
    const err = new Error("Origin check failed");
    err.statusCode = 403;
    throw err;
  }
}
function parseCookies(event){
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) ? String(event.headers.cookie || event.headers.Cookie) : "";
  const out = {};
  raw.split(";").map(s => s.trim()).filter(Boolean).forEach(kv => {
    const i = kv.indexOf("=");
    if(i < 0) return;
    const k = kv.slice(0, i).trim();
    const v = kv.slice(i+1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function cookie(name, value, opts = {}){
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if(opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if(opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  if(opts.path) parts.push(`Path=${opts.path}`); else parts.push("Path=/");
  if(opts.httpOnly) parts.push("HttpOnly");
  if(opts.secure !== false) parts.push("Secure");
  if(opts.sameSite) parts.push(`SameSite=${opts.sameSite}`); else parts.push("SameSite=Strict");
  return parts.join("; ");
}

function getBearer(event){
  const h = event.headers && (event.headers.authorization || event.headers.Authorization);
  if(!h) return "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function getAuthToken(event){
  const cookies = parseCookies(event);
  if(cookies.SMV_AUTH) return cookies.SMV_AUTH;
  const b = getBearer(event);
  return b || "";
}

function verifyAuth(event){
  const token = getAuthToken(event);
  if(!token) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  const secret = requireEnv("JWT_SECRET");
  try{
    return jwt.verify(token, secret);
  }catch(e){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

function requireCsrf(event){
  const method = (event.httpMethod || "GET").toUpperCase();
  if(method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const cookies = parseCookies(event);
  const c = cookies.SMV_CSRF || "";
  const h = (event.headers && (event.headers["x-csrf-token"] || event.headers["X-CSRF-Token"])) ? String(event.headers["x-csrf-token"] || event.headers["X-CSRF-Token"]) : "";
  if(!c || !h || c !== h){
    const err = new Error("CSRF validation failed");
    err.statusCode = 403;
    throw err;
  }
  requireOriginForCookieAuth(event);
}

function issueAuthCookies({ token, csrf }){
  const days14 = 60 * 60 * 24 * 14;
  return [
    cookie("SMV_AUTH", token, { httpOnly:true, maxAge: days14, sameSite:"Strict" }),
    cookie("SMV_CSRF", csrf, { httpOnly:false, maxAge: days14, sameSite:"Strict" })
  ];
}

function clearAuthCookies(){
  const past = new Date(0);
  return [
    cookie("SMV_AUTH", "", { httpOnly:true, expires: past, sameSite:"Strict" }),
    cookie("SMV_CSRF", "", { httpOnly:false, expires: past, sameSite:"Strict" })
  ];
}

function parseJson(event){
  try{
    return event.body ? JSON.parse(event.body) : {};
  }catch(e){
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}

function getClientIp(event){
  const h = event.headers || {};
  const xf = h["x-nf-client-connection-ip"] || h["X-NF-Client-Connection-Ip"] || h["x-forwarded-for"] || h["X-Forwarded-For"];
  if(xf) return String(xf).split(",")[0].trim();
  const xr = h["x-real-ip"] || h["X-Real-IP"];
  if(xr) return String(xr).trim();
  return "0.0.0.0";
}

function hashIp(ip){
  const salt = requireEnv("IP_HASH_SALT");
  return crypto.createHash("sha256").update(String(ip) + "|" + salt).digest("hex");
}

function randomToken(bytes=32){
  return crypto.randomBytes(bytes).toString("base64url");
}

async function enforceRateLimit({ countIpWindow, countHandleWindow, ipLimit, handleLimit, ipWindowLabel, handleWindowLabel }){
  const [ipCount, handleCount] = await Promise.all([countIpWindow(), countHandleWindow()]);
  if(ipCount >= ipLimit){
    const err = new Error(`Rate limit exceeded: too many requests from this IP (${ipWindowLabel}).`);
    err.statusCode = 429;
    throw err;
  }
  if(handleCount >= handleLimit){
    const err = new Error(`Rate limit exceeded: recipient is receiving too many messages (${handleWindowLabel}).`);
    err.statusCode = 429;
    throw err;
  }
}

function hybridEncryptNode(publicKeyPem, payloadObj){
  const plaintext = Buffer.from(JSON.stringify(payloadObj), "utf8");
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ctPlus = Buffer.concat([ct, tag]);

  const encKey = crypto.publicEncrypt(
    { key: publicKeyPem, oaepHash: "sha256", padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );

  return {
    encrypted_key_b64: encKey.toString("base64"),
    iv_b64: iv.toString("base64"),
    ciphertext_b64: ctPlus.toString("base64")
  };
}

function hybridEncryptBytesNode(publicKeyPem, bytesBuffer){
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ct = Buffer.concat([cipher.update(bytesBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ctPlus = Buffer.concat([ct, tag]);

  const encKey = crypto.publicEncrypt(
    { key: publicKeyPem, oaepHash: "sha256", padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );

  return {
    encrypted_key_b64: encKey.toString("base64"),
    iv_b64: iv.toString("base64"),
    ciphertext: ctPlus
  };
}

function getSiteUrl(){
  return process.env.PUBLIC_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "";
}

function requireBasicAuth(event, opts = {}){
  const userEnv = opts.userEnv || "INBOUND_BASIC_USER";
  const passEnv = opts.passEnv || "INBOUND_BASIC_PASS";
  const expectedUser = process.env[userEnv] ? String(process.env[userEnv]) : "";
  const expectedPass = process.env[passEnv] ? String(process.env[passEnv]) : "";

  // If credentials are not set, do not enforce.
  if(!expectedUser || !expectedPass) return;

  const h = event.headers && (event.headers.authorization || event.headers.Authorization);
  const auth = h ? String(h) : "";
  const m = auth.match(/^Basic\s+(.+)$/i);
  if(!m){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  let user = "", pass = "";
  try{
    const decoded = Buffer.from(m[1], "base64").toString("utf8");
    const i = decoded.indexOf(":");
    user = i >= 0 ? decoded.slice(0, i) : decoded;
    pass = i >= 0 ? decoded.slice(i+1) : "";
  }catch(e){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  // timing-safe compare
  const aU = Buffer.from(user, "utf8");
  const bU = Buffer.from(expectedUser, "utf8");
  const aP = Buffer.from(pass, "utf8");
  const bP = Buffer.from(expectedPass, "utf8");

  const okU = (aU.length === bU.length) && crypto.timingSafeEqual(aU, bU);
  const okP = (aP.length === bP.length) && crypto.timingSafeEqual(aP, bP);

  if(!(okU && okP)){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
}


async function verifyTurnstile(token, ip){
  const secret = process.env.TURNSTILE_SECRET_KEY ? String(process.env.TURNSTILE_SECRET_KEY) : "";
  if(!secret) return true; // not enabled
  const t = String(token || "").trim();
  if(!t) {
    const err = new Error("Bot check required (Turnstile).");
    err.statusCode = 400;
    throw err;
  }
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", t);
  if(ip) form.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const data = await res.json().catch(() => ({}));
  if(!data || data.success !== true){
    const err = new Error("Bot check failed.");
    err.statusCode = 400;
    throw err;
  }
  return true;
}



function parseFormUrlEncoded(body){
  const out = {};
  const sp = new URLSearchParams(String(body || ""));
  for(const [k,v] of sp.entries()){
    out[k] = v;
  }
  return out;
}


async function verifyAuthSession(event, opts = {}){
  const auth = verifyAuth(event);
  const userId = auth.sub;
  const jti = auth.jti;
  if(!userId || !jti){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  const res = await query(
    `select s.jti, s.revoked_at, s.expires_at, s.last_seen_at, s.created_at,
            u.is_active, u.org_id,
            o.require_sso, o.session_idle_minutes, o.session_max_days
     from sessions s
     join users u on u.id = s.user_id
     left join organizations o on o.id = u.org_id
     where s.user_id=$1 and s.jti=$2
     limit 1`,
    [userId, jti]
  );

  if(!res.rows.length){
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  const row = res.rows[0];
  if(row.revoked_at){
    const err = new Error("Session revoked");
    err.statusCode = 401;
    throw err;
  }

  // Disabled user kills session immediately
  if(row.is_active === false){
    await query(`update sessions set revoked_at=now(), revoke_reason=$3 where user_id=$1 and jti=$2 and revoked_at is null`, [userId, jti, "user_deactivated"]);
    const err = new Error("Account deactivated");
    err.statusCode = 401;
    throw err;
  }

  // expiry check
  const exp = row.expires_at ? new Date(row.expires_at) : null;
  if(exp && exp.getTime() < Date.now()){
    await query(`update sessions set revoked_at=now(), revoke_reason=$3 where user_id=$1 and jti=$2 and revoked_at is null`, [userId, jti, "expired"]);
    const err = new Error("Session expired");
    err.statusCode = 401;
    throw err;
  }

  // idle timeout (org policy)
  const idleMin = Number(row.session_idle_minutes || 0);
  if(idleMin > 0 && row.last_seen_at){
    const last = new Date(row.last_seen_at).getTime();
    const cutoff = Date.now() - idleMin*60*1000;
    if(last < cutoff){
      await query(`update sessions set revoked_at=now(), revoke_reason=$3 where user_id=$1 and jti=$2 and revoked_at is null`, [userId, jti, "idle_timeout"]);
      const err = new Error("Session expired");
      err.statusCode = 401;
      throw err;
    }
  }

  // max session age (org policy)
  const maxDays = Number(row.session_max_days || 0);
  if(maxDays > 0 && row.created_at){
    const created = new Date(row.created_at).getTime();
    const cutoff = Date.now() - maxDays*24*60*60*1000;
    if(created < cutoff){
      await query(`update sessions set revoked_at=now(), revoke_reason=$3 where user_id=$1 and jti=$2 and revoked_at is null`, [userId, jti, "max_age"]);
      const err = new Error("Session expired");
      err.statusCode = 401;
      throw err;
    }
  }


  if(opts.touch !== false){
    await query(`update sessions set last_seen_at=now() where user_id=$1 and jti=$2`, [userId, jti]);
  }

  return auth;
}

async function revokeSessionByJti(userId, jti, reason="revoked"){
  await query(
    `update sessions set revoked_at=now(), revoke_reason=$3
     where user_id=$1 and jti=$2 and revoked_at is null`,
    [userId, jti, String(reason)]
  );
}

async function revokeAllSessionsForUser(userId, reason="revoked"){
  await query(
    `update sessions set revoked_at=now(), revoke_reason=$2
     where user_id=$1 and revoked_at is null`,
    [userId, String(reason)]
  );
}

module.exports = {
  json, jsonCookies, requireEnv, parseCookies, cookie,
  getBearer, getAuthToken, verifyAuth, requireCsrf,
  issueAuthCookies, clearAuthCookies,
  parseJson, getClientIp, hashIp, randomToken, enforceRateLimit,
  hybridEncryptNode, hybridEncryptBytesNode,
  getSiteUrl, requireBasicAuth,
  verifyTurnstile,
  parseFormUrlEncoded,
  requireMethod, requireOriginForCookieAuth,
  verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser
};
