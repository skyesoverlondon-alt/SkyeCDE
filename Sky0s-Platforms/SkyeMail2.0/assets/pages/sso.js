(async () => {
  const status = qs("#status");
  const orgInput = qs("#org");
  const btnSaml = qs("#btnSaml");
  const btnOidc = qs("#btnOidc");

  async function refresh(){
    const slug = (orgInput.value || "").trim();
    if(!slug){
      btnSaml.disabled = false;
      btnOidc.disabled = false;
      setStatus(status, "Enter your org slug.", "");
      return;
    }
    try{
      const r = await apiFetch("/sso-discovery?org=" + encodeURIComponent(slug));
      if(!r.org){
        btnSaml.disabled = true;
        btnOidc.disabled = true;
        setStatus(status, "Org not found (check slug).", "danger");
        return;
      }
      btnSaml.disabled = !r.org.saml_enabled;
      btnOidc.disabled = !r.org.oidc_enabled;

      const pref = r.org.sso_preferred || (r.org.oidc_enabled ? "oidc" : "saml");
      setStatus(status,
        `Org: ${r.org.name} • SAML: ${r.org.saml_enabled ? "on" : "off"} • OIDC: ${r.org.oidc_enabled ? "on" : "off"} • preferred: ${pref}`,
        "ok"
      );
    }catch(e){
      btnSaml.disabled = false;
      btnOidc.disabled = false;
      setStatus(status, e.message || "Failed to discover org.", "danger");
    }
  }

  orgInput.addEventListener("input", () => { refresh(); });

  btnSaml.addEventListener("click", (e) => {
    e.preventDefault();
    const slug = (orgInput.value || "").trim();
    if(!slug){ setStatus(status, "Org slug required.", "danger"); return; }
    location.href = "/sso/saml/login?org=" + encodeURIComponent(slug);
  });

  btnOidc.addEventListener("click", (e) => {
    e.preventDefault();
    const slug = (orgInput.value || "").trim();
    if(!slug){ setStatus(status, "Org slug required.", "danger"); return; }
    location.href = "/sso/oidc/login?org=" + encodeURIComponent(slug);
  });

  // Prefill org from querystring (?org=)
  try{
    const u = new URL(location.href);
    const q = u.searchParams.get("org");
    if(q){ orgInput.value = q; }
  }catch(e){}
  await refresh();
})();