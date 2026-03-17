const { json, requireMethod } = require("./_utils");

const CACHE = new Map(); // key -> { exp:number, data:any }

function now(){ return Date.now(); }
function normIssuer(s){
  const x = String(s||"").trim();
  return x.replace(/\/+$/,'');
}

function isEntraIssuer(issuer){
  return /login\.microsoftonline\.com/i.test(issuer);
}

function issuerForDiscovery(issuer){
  // Allow templates like https://login.microsoftonline.com/{tenant}/v2.0
  let x = issuer;
  x = x.replace(/\{tenantid\}/ig, "common").replace(/\{tenant\}/ig, "common");
  x = x.replace(/\/+$/,'');
  return x;
}

async function fetchWellKnown(issuer){
  const base = issuer.replace(/\/+$/,'');
  const url = base + "/.well-known/openid-configuration";
  const controller = new AbortController();
  const t = setTimeout(()=> controller.abort(), 7000);
  try{
    const res = await fetch(url, { headers:{ "Accept":"application/json" }, signal: controller.signal });
    if(!res.ok) throw new Error("OIDC discovery failed: " + res.status);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");

    const qs = event.queryStringParameters || {};
    const issuerRaw = String(qs.issuer || "").trim();
    if(!issuerRaw) return json(400, { error:"issuer required" });

    const issuer = normIssuer(issuerRaw);
    const discIssuer = issuerForDiscovery(issuer);
    const cacheKey = discIssuer;

    const cached = CACHE.get(cacheKey);
    if(cached && cached.exp > now()){
      return json(200, cached.data);
    }

    const wk = await fetchWellKnown(discIssuer);

    const out = {
      ok: true,
      issuer_input: issuer,
      issuer_discovery: discIssuer,
      issuer_well_known: wk.issuer,
      authorization_endpoint: wk.authorization_endpoint,
      token_endpoint: wk.token_endpoint,
      jwks_uri: wk.jwks_uri,
      end_session_endpoint: wk.end_session_endpoint || null,
      supports_pkce: true,
      entra_multi_tenant: (isEntraIssuer(issuer) && /\/(common|organizations|consumers)\/v2\.0$/i.test(discIssuer)) ? true : false,
      notes: (isEntraIssuer(issuer) ? "For Entra multi-tenant apps, the id_token issuer is tenant-specific (tid). Configure issuer as https://login.microsoftonline.com/common/v2.0 and optionally restrict allowed tenant IDs." : "")
    };

    CACHE.set(cacheKey, { exp: now() + 60*60*1000, data: out });
    return json(200, out);

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
