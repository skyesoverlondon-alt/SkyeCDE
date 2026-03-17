const { query } = require("./_db");
const { json, parseJson, requireMethod } = require("./_utils");
const { getOrgContext, requireAdmin } = require("./_orgauth");
const { kmsEncryptToB64, configKmsKeyId } = require("./_kms");

function normIssuer(s){
  const x = String(s||"").trim();
  return x.replace(/\/+$/,'');
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    const ctx = await getOrgContext(event);
    requireAdmin(ctx.role);

    const body = parseJson(event);
    const enabled = !!body.enabled;
    const issuer = normIssuer(body.issuer);
    const client_id = String(body.client_id||"").trim();
    const client_secret = String(body.client_secret||"").trim();
    const scopes = String(body.scopes||"openid email profile").trim() || "openid email profile";
    const allowed_domains_csv = String(body.allowed_domains_csv||"").trim() || null;
    const allowed_tenants_csv = String(body.allowed_tenants_csv||"").trim() || null;
    const sso_preferred = String(body.sso_preferred||"oidc").trim().toLowerCase();

    // OIDC requires KMS mode so we can provision keys for JIT users without passphrase
    const orgRow = await query(`select key_management_mode from organizations where id=$1 limit 1`, [ctx.orgId]);
    const km = orgRow.rows.length ? orgRow.rows[0].key_management_mode : null;
    if(km !== "kms"){
      return json(409, { error: "OIDC SSO requires organization key_management_mode='kms' (KMS-managed keys)." });
    }

    if(enabled){
      if(!issuer) return json(400, { error:"issuer required" });
      if(!client_id) return json(400, { error:"client_id required" });
      if(!client_secret) return json(400, { error:"client_secret required" });
    }

    let secret_enc = null;
    if(client_secret){
      secret_enc = await kmsEncryptToB64(client_secret, configKmsKeyId());
    }

    await query(
      `insert into oidc_configs(org_id, enabled, issuer, client_id, client_secret_enc, scopes, allowed_domains_csv, allowed_tenants_csv)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict(org_id) do update set
         enabled=excluded.enabled,
         issuer=excluded.issuer,
         client_id=excluded.client_id,
         client_secret_enc=coalesce(excluded.client_secret_enc, oidc_configs.client_secret_enc),
         scopes=excluded.scopes,
         allowed_domains_csv=excluded.allowed_domains_csv,
         allowed_tenants_csv=excluded.allowed_tenants_csv,
         updated_at=now()`,
      [ctx.orgId, enabled, issuer, client_id, secret_enc || "", scopes, allowed_domains_csv]
    );

    // preference hint for UX
    if(sso_preferred === "oidc" || sso_preferred === "saml"){
      await query(`update organizations set sso_preferred=$2 where id=$1`, [ctx.orgId, sso_preferred]);
    }

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
