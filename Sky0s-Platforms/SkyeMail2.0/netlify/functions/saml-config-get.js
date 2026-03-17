const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod, getSiteUrl} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const u = await query(
      `select u.org_id, o.slug
       from users u left join organizations o on o.id=u.org_id
       where u.id=$1 limit 1`,
      [userId]
    );
    const orgId = u.rows.length ? u.rows[0].org_id : null;
    const slug = u.rows.length ? (u.rows[0].slug || "") : "";
    if(!orgId) return json(200, { enabled:false, slug });

    const c = await query(
      `select enabled, idp_entity_id, idp_sso_url, sp_entity_id, idp_x509_cert_pem, want_assertions_signed, want_response_signed, updated_at
       from saml_configs where org_id=$1 limit 1`,
      [orgId]
    );
    const base = getSiteUrl();
    const acs = base ? `${base}/sso/saml/acs` : "";
    if(!c.rows.length) return json(200, { enabled:false, acs_url: acs, slug });

    const row = c.rows[0];
    return json(200, {
      enabled: !!row.enabled,
      slug,
      idp_entity_id: row.idp_entity_id,
      idp_sso_url: row.idp_sso_url,
      sp_entity_id: row.sp_entity_id,
      idp_x509_cert_pem: row.idp_x509_cert_pem || "",
      want_assertions_signed: (row.want_assertions_signed !== false),
      want_response_signed: !!row.want_response_signed,
      acs_url: acs,
      updated_at: row.updated_at
    });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
