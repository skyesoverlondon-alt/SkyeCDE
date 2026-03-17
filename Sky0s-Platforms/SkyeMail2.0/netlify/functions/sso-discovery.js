const { query } = require("./_db");
const { json, requireMethod } = require("./_utils");

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const qs = event.queryStringParameters || {};
    const slug = String(qs.org || "").trim().toLowerCase();
    if(!slug) return json(200, { ok:true, org:null });

    const r = await query(
      `select o.name, o.slug, o.sso_preferred,
              exists(select 1 from saml_configs s where s.org_id=o.id and s.enabled=true) as saml_enabled,
              exists(select 1 from oidc_configs c where c.org_id=o.id and c.enabled=true) as oidc_enabled
       from organizations o
       where lower(o.slug)=lower($1)
       limit 1`,
      [slug]
    );

    if(!r.rows.length) return json(200, { ok:true, org:null });
    return json(200, { ok:true, org: r.rows[0] });
  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
