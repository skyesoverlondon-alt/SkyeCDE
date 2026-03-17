const zlib = require("zlib");
const crypto = require("crypto");
const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod, getSiteUrl} = require("./_utils");
const SIGALG = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

function base64deflate(xml){
  const deflated = zlib.deflateRawSync(Buffer.from(xml, "utf8"), { level: 9 });
  return deflated.toString("base64");
}

function buildAuthnRequest({ id, issueInstant, destination, acsUrl, spEntityId }){
  return `<?xml version="1.0" encoding="UTF-8"?>` +
`<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
`xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
`ID="${id}" Version="2.0" IssueInstant="${issueInstant}" ` +
`Destination="${escapeXml(destination)}" ` +
`AssertionConsumerServiceURL="${escapeXml(acsUrl)}" ` +
`ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">` +
`<saml:Issuer>${escapeXml(spEntityId)}</saml:Issuer>` +
`<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>` +
`</samlp:AuthnRequest>`;
}

function escapeXml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}

function signRedirectQuery({ samlRequest, relayState, sigAlg, privateKeyPem }){
  const parts = [];
  parts.push("SAMLRequest=" + encodeURIComponent(samlRequest));
  if(relayState) parts.push("RelayState=" + encodeURIComponent(relayState));
  parts.push("SigAlg=" + encodeURIComponent(sigAlg));
  const toSign = parts.join("&");

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(toSign);
  signer.end();
  const signature = signer.sign(privateKeyPem).toString("base64");
  return { toSign, signature };
}

exports.handler = async (event) => {
  try{
    requireMethod(event, ["GET"]);
    if((event.httpMethod||"GET").toUpperCase() !== "GET"){
      return json(405, { error: "Method not allowed" });
    }

    const qs = event.queryStringParameters || {};
    const orgSlug = String(qs.org || "").trim().toLowerCase();
    if(!orgSlug) return json(400, { error: "org (slug) is required" });

    const base = getSiteUrl();
    if(!base) return json(500, { error: "PUBLIC_BASE_URL (or Netlify URL) missing" });

    const spPrivateKey = requireEnv("SAML_SP_PRIVATE_KEY_PEM");

    const o = await query(`select id, slug from organizations where lower(slug)=lower($1) limit 1`, [orgSlug]);
    if(!o.rows.length) return json(404, { error: "Organization not found" });
    const orgId = o.rows[0].id;

    const c = await query(
      `select enabled, idp_entity_id, idp_sso_url, sp_entity_id
       from saml_configs where org_id=$1 limit 1`,
      [orgId]
    );
    if(!c.rows.length || !c.rows[0].enabled) return json(400, { error: "SAML not enabled for this organization" });

    const cfg = c.rows[0];

    const requestId = "_" + crypto.randomBytes(16).toString("hex");
    const issueInstant = new Date().toISOString();

    const acsUrl = `${base}/sso/saml/acs`; // rewritten to function via _redirects

    const xml = buildAuthnRequest({
      id: requestId,
      issueInstant,
      destination: cfg.idp_sso_url,
      acsUrl,
      spEntityId: cfg.sp_entity_id
    });

    const samlRequest = base64deflate(xml);
    const relayState = orgSlug;

    // Persist request to enforce SP-initiated (reject unsolicited/IdP-initiated)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await query(
      `insert into saml_requests(org_id, request_id, relay_state, expires_at)
       values($1,$2,$3,$4)`,
      [orgId, requestId, relayState, expiresAt]
    );

    const { signature } = signRedirectQuery({
      samlRequest,
      relayState,
      sigAlg: SIGALG,
      privateKeyPem: spPrivateKey
    });

    const url = new URL(cfg.idp_sso_url);
    url.searchParams.set("SAMLRequest", samlRequest);
    url.searchParams.set("RelayState", relayState);
    url.searchParams.set("SigAlg", SIGALG);
    url.searchParams.set("Signature", signature);

    // Optional: a short-lived hint cookie for troubleshooting; not relied on for auth.
    const hint = cookie("SMV_SAML", requestId, { httpOnly: true, maxAge: 300, sameSite: "Lax" });

    return {
      statusCode: 302,
      headers: { "Location": url.toString(), "Cache-Control":"no-store" },
      multiValueHeaders: { "Set-Cookie": [hint] },
      body: ""
    };

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
