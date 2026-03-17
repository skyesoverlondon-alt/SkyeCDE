const { query } = require("./_db");
const { json, requireMethod } = require("./_utils");
const { getOrgContext, requireAdmin } = require("./_orgauth");

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const ctx = await getOrgContext(event);
    requireAdmin(ctx.role);

    const r = await query(
      `select enabled, issuer, client_id, scopes, allowed_domains_csv, allowed_tenants_csv,
              (client_secret_enc is not null and client_secret_enc <> '') as has_client_secret,
              created_at, updated_at
       from oidc_configs where org_id=$1 limit 1`,
      [ctx.orgId]
    );

    return json(200, { ok:true, config: r.rows.length ? r.rows[0] : null });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
