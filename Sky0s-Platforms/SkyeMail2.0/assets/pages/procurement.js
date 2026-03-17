(async () => {
  qs("#btnLogout").addEventListener("click", logout);

  const who = qs("#who");
  const status = qs("#status");

  const kmsMode = qs("#kmsMode");
  const kmsKeyId = qs("#kmsKeyId");
  const kmsStatus = qs("#kmsStatus");

  const siemProvider = qs("#siemProvider");
  const siemEndpoint = qs("#siemEndpoint");
  const siemToken = qs("#siemToken");
  const siemEnabled = qs("#siemEnabled");
  const siemStatus = qs("#siemStatus");

  const scimTokenOut = qs("#scimTokenOut");
  const scimStatus = qs("#scimStatus");

  const dlpAction = qs("#dlpAction");
  const dlpKeywords = qs("#dlpKeywords");
  const dlpStatus = qs("#dlpStatus");

  const samlEnabled = qs("#samlEnabled");
  const samlSlug = qs("#samlSlug");
  const samlIdpEntity = qs("#samlIdpEntity");
  const samlIdpSso = qs("#samlIdpSso");
  const samlSpEntity = qs("#samlSpEntity");
  const samlIdpCert = qs("#samlIdpCert");
  const samlWantAssertionsSigned = qs("#samlWantAssertionsSigned");
  const samlWantResponseSigned = qs("#samlWantResponseSigned");
  const samlStatus = qs("#samlStatus");
  const btnSamlPresetOkta = qs("#btnSamlPresetOkta");
  const btnSamlPresetEntraResponse = qs("#btnSamlPresetEntraResponse");

  const edStatus = qs("#edStatus");

  const me = await requireMe();
  if(!me) return;

  if(btnSamlPresetOkta){
    btnSamlPresetOkta.addEventListener("click", (e) => {
      e.preventDefault();
      samlWantAssertionsSigned.checked = true;
      samlWantResponseSigned.checked = false;
      setStatus(samlStatus, "Preset applied: Okta Default (Assertion Signed required).", "ok");
    });
  }
  if(btnSamlPresetEntraResponse){
    btnSamlPresetEntraResponse.addEventListener("click", (e) => {
      e.preventDefault();
      samlWantAssertionsSigned.checked = false;
      samlWantResponseSigned.checked = true;
      setStatus(samlStatus, "Preset applied: Entra Response-Signed (Response Signed required).", "ok");
    });
  }


  who.textContent = `${me.handle} • ${me.email} • role: ${me.org_role || "n/a"} • key mgmt: ${me.org_key_management_mode || "passphrase"}`;

  if(!me.org_id){
    setStatus(status, "No organization found. Create/join an org first.", "danger");
    return;
  }
  if(!["owner","admin"].includes(me.org_role || "")){
    setStatus(status, "Admin/Owner role required for procurement controls.", "danger");
    return;
  }

  async function loadAll(){
    try{
      // KMS
      const k = await apiFetch("/kms-config-get");
      kmsMode.value = k.key_management_mode || "passphrase";
      kmsKeyId.value = k.kms_key_id || "";

      // SIEM
      const s = await apiFetch("/siem-config-get");
      siemProvider.value = s.provider || "splunk";
      siemEndpoint.value = s.endpoint || "";
      siemEnabled.checked = !!s.enabled;

      // DLP
      const d = await apiFetch("/dlp-policy-get");
      dlpAction.value = d.action || "off";
      const kws = (d.patterns || []).filter(p => p.type === "keyword").map(p => p.value);
      dlpKeywords.value = kws.join("\n");

      // SAML
      const saml = await apiFetch("/saml-config-get");
      samlEnabled.checked = !!saml.enabled;
      samlSlug.value = (saml.slug || "");
      samlIdpEntity.value = (saml.idp_entity_id || "");
      samlIdpSso.value = (saml.idp_sso_url || "");
      samlSpEntity.value = (saml.sp_entity_id || "");
      samlIdpCert.value = (saml.idp_x509_cert_pem || "");
      if(samlWantAssertionsSigned) samlWantAssertionsSigned.checked = (saml.want_assertions_signed !== false);
      if(samlWantResponseSigned) samlWantResponseSigned.checked = !!saml.want_response_signed;


      // OIDC
      try{
        const oc = await apiFetch("/oidc-config-get");
        const c = oc && oc.config ? oc.config : null;
        oidcEnabled.checked = !!(c && c.enabled);
        oidcIssuer.value = (c && c.issuer) ? c.issuer : "";
        oidcClientId.value = (c && c.client_id) ? c.client_id : "";
        oidcScopes.value = (c && c.scopes) ? c.scopes : "openid email profile";
        oidcDomains.value = (c && c.allowed_domains_csv) ? c.allowed_domains_csv : "";
        oidcTenants.value = (c && c.allowed_tenants_csv) ? c.allowed_tenants_csv : "";
        // sso preferred hint
        if(c && c.enabled){ ssoPreferred.value = "oidc"; }
      }catch(_e){}

// cert is not returned for security; you can paste it again when updating.
      const base = location.origin;
      const orgSlug = (samlSlug.value || "").trim();
      const test = qs("#btnTestSaml");
      if(test){ test.href = orgSlug ? (base + "/.netlify/functions/sso-saml-login?org=" + encodeURIComponent(orgSlug)) : "#"; }
    }catch(e){
      setStatus(status, e.message || "Failed to load settings.", "danger");
    }
  }

  qs("#btnSaveKms").addEventListener("click", async () => {
    try{
      setStatus(kmsStatus, "Saving…", "");
      await apiFetch("/kms-config-set", { method:"POST", body: JSON.stringify({ key_management_mode: kmsMode.value, kms_key_id: kmsKeyId.value }) });
      setStatus(kmsStatus, "Saved.", "ok");
    }catch(e){
      setStatus(kmsStatus, e.message || "Failed.", "danger");
    }
  });

  qs("#btnSaveSiem").addEventListener("click", async () => {
    try{
      setStatus(siemStatus, "Saving…", "");
      await apiFetch("/siem-config-set", { method:"POST", body: JSON.stringify({ enabled: siemEnabled.checked, provider: siemProvider.value, endpoint: siemEndpoint.value, token: siemToken.value }) });
      siemToken.value = "";
      setStatus(siemStatus, "Saved.", "ok");
    }catch(e){
      setStatus(siemStatus, e.message || "Failed.", "danger");
    }
  });

  qs("#btnCreateScim").addEventListener("click", async () => {
    try{
      setStatus(scimStatus, "Creating token…", "");
      const out = await apiFetch("/scim-token-create", { method:"POST", body:"{}" });
      scimTokenOut.value = out.token || "";
      setStatus(scimStatus, "Token created. Copy it now.", "ok");
    }catch(e){
      setStatus(scimStatus, e.message || "Failed.", "danger");
    }
  });

  qs("#btnSaveDlp").addEventListener("click", async () => {
    try{
      setStatus(dlpStatus, "Saving…", "");
      const kws = (dlpKeywords.value || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 50);
      const patterns = kws.map(k => ({ type:"keyword", value:k, label:k }));
      await apiFetch("/dlp-policy-set", { method:"POST", body: JSON.stringify({ action: dlpAction.value, patterns }) });
      setStatus(dlpStatus, "Saved.", "ok");
    }catch(e){
      setStatus(dlpStatus, e.message || "Failed.", "danger");
    }
  });

  function downloadJson(filename, obj){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 400);
  }

  qs("#btnExportMsgs").addEventListener("click", async () => {
    try{
      setStatus(edStatus, "Exporting messages…", "");
      const out = await apiFetch("/ediscovery-export?type=messages&limit=200&offset=0");
      downloadJson("ediscovery_messages.json", out);
      setStatus(edStatus, "Export downloaded.", "ok");
    }catch(e){
      setStatus(edStatus, e.message || "Failed.", "danger");
    }
  });

  qs("#btnExportAudit").addEventListener("click", async () => {
    try{
      setStatus(edStatus, "Exporting audit…", "");
      const out = await apiFetch("/ediscovery-export?type=audit&limit=200&offset=0");
      downloadJson("ediscovery_audit.json", out);
      setStatus(edStatus, "Export downloaded.", "ok");
    }catch(e){
      setStatus(edStatus, e.message || "Failed.", "danger");
    }
  });


  
  qs("#btnSaveOidc").addEventListener("click", async () => {
    try{
      setStatus(oidcStatus, "Saving…", "");
      await apiFetch("/oidc-config-set", {
        method:"POST",
        body: JSON.stringify({
          enabled: !!oidcEnabled.checked,
          issuer: (oidcIssuer.value || "").trim(),
          client_id: (oidcClientId.value || "").trim(),
          client_secret: (oidcClientSecret.value || "").trim(),
          scopes: (oidcScopes.value || "").trim(),
          allowed_domains_csv: (oidcDomains.value || "").trim(),
          sso_preferred: (ssoPreferred.value || "oidc")
        })
      });
      oidcClientSecret.value = "";
      setStatus(oidcStatus, "Saved OIDC config.", "ok");
      await loadAll();
    }catch(e){
      setStatus(oidcStatus, e.message || "Save failed.", "danger");
    }
  });

qs("#btnSaveSaml").addEventListener("click", async () => {
    try{
      setStatus(samlStatus, "Saving…", "");
      await apiFetch("/saml-config-set", { method:"POST", body: JSON.stringify({
        enabled: samlEnabled.checked,
        slug: samlSlug.value,
        idp_entity_id: samlIdpEntity.value,
        idp_sso_url: samlIdpSso.value,
        sp_entity_id: samlSpEntity.value,
        idp_x509_cert_pem: samlIdpCert.value,
        want_assertions_signed: samlWantAssertionsSigned ? samlWantAssertionsSigned.checked : true,
        want_response_signed: samlWantResponseSigned ? samlWantResponseSigned.checked : false
      })});
      setStatus(samlStatus, "Saved.", "ok");
      const test = qs("#btnTestSaml");
      const orgSlug = (samlSlug.value || "").trim();
      if(test){ test.href = orgSlug ? (location.origin + "/.netlify/functions/sso-saml-login?org=" + encodeURIComponent(orgSlug)) : "#"; }
    }catch(e){
      setStatus(samlStatus, e.message || "Failed.", "danger");
    }
  });

  await loadAll();
})();
