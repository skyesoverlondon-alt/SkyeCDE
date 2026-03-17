(async () => {
  const status = qs("#status");
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";
  if(!token){
    setStatus(status, "Missing verification token.", "danger");
    return;
  }
  try{
    await apiFetch("/auth-verify-email", { method:"POST", body: JSON.stringify({ token }) });
    setStatus(status, "Email verified. Redirecting to login…", "ok");
    setTimeout(() => location.href = "/login.html?verified=1", 750);
  }catch(err){
    setStatus(status, (err && err.data && err.data.error) ? err.data.error : (err.message || "Verification failed"), "danger");
  }
})();
