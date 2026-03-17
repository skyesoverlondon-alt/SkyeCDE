(async () => {
  const status = qs("#status");
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";

  if(!token){
    setStatus(status, "Missing reset token. Use the link from your email.", "danger");
    return;
  }

  qs("#btnReset").addEventListener("click", async (e) => {
    e.preventDefault();
    const pw1 = qs("#pw1").value || "";
    const pw2 = qs("#pw2").value || "";
    if(pw1.length < 10){
      setStatus(status, "Password must be at least 10 characters.", "danger");
      return;
    }
    if(pw1 !== pw2){
      setStatus(status, "Passwords do not match.", "danger");
      return;
    }
    setStatus(status, "Updating…", "");
    try{
      await apiFetch("/auth-reset-password", { method:"POST", body: JSON.stringify({ token, new_password: pw1 }) });
      setStatus(status, "Password updated. Redirecting to login…", "ok");
      setTimeout(() => location.href = "/login.html?reset=1", 650);
    }catch(err){
      setStatus(status, (err && err.data && err.data.error) ? err.data.error : (err.message || "Failed"), "danger");
    }
  });
})();
