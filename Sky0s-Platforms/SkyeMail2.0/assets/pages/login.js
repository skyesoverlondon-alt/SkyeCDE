(async () => {
  const status = qs("#status");
  const verifyBox = qs("#verifyBox");
  const verifyStatus = qs("#verifyStatus");
  const btnResend = qs("#btnResendVerify");

  function showVerifyBox(show){
    if(!verifyBox) return;
    verifyBox.hidden = !show;
    if(!show) verifyStatus.textContent = "";
  }

  async function doLogin(){
    setStatus(status, "Signing in…", "");
    showVerifyBox(false);

    const ident = (qs("#ident").value || "").trim();
    const password = qs("#password").value || "";
    try{
      const data = await apiFetch("/auth-login", { method:"POST", body: JSON.stringify({ ident, password }) });
      setHandle(data.handle || "");
      setStatus(status, "Logged in. Redirecting…", "ok");
      setTimeout(() => location.href = "/dashboard.html", 350);
    }catch(err){
      const msg = err && err.data && err.data.error ? err.data.error : (err.message || "Login failed");
      if(err && err.status === 403 && err.data && err.data.needs_verification){
        setStatus(status, msg, "danger");
        showVerifyBox(true);
        btnResend.onclick = async () => {
          try{
            verifyStatus.textContent = "Sending…";
            await apiFetch("/auth-resend-verification", { method:"POST", body: JSON.stringify({ ident }) });
            verifyStatus.textContent = "Verification email sent (if the account exists).";
          }catch(e){
            verifyStatus.textContent = "Failed to send. Try again later.";
          }
        };
        return;
      }
      setStatus(status, msg, "danger");
    }
  }

  qs("#btnLogin").addEventListener("click", (e) => { e.preventDefault(); doLogin(); });
  qs("#password").addEventListener("keydown", (e) => { if(e.key === "Enter") doLogin(); });

  // Friendly post-verify/reset signals
  const params = new URLSearchParams(location.search);
  if(params.get("verified") === "1"){
    setStatus(status, "Email verified. You can log in now.", "ok");
  }
  if(params.get("reset") === "1"){
    setStatus(status, "Password updated. You can log in now.", "ok");
  }

  const samlStatus = qs("#samlStatus");
  const btnSaml = qs("#btnSaml");

  if(btnSaml){
    btnSaml.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = (qs("#org_slug").value || "").trim().toLowerCase();
      if(!slug){
        setStatus(samlStatus, "Organization slug required for SAML.", "danger");
        return;
      }
      setStatus(samlStatus, "Redirecting to IdP…", "");
      location.href = "/sso/saml/login?org=" + encodeURIComponent(slug);
    });
  }

})();
