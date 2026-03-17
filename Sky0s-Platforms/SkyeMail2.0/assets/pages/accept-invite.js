(async () => {
  const status = qs("#status");
  const params = new URLSearchParams(location.search);
  const token = params.get("token") || "";
  if(!token){
    setStatus(status, "Missing invite token.", "danger");
    return;
  }

  // Must be logged in
  const me = await requireMe();
  if(!me){
    // requireMe redirects to login
    return;
  }

  try{
    setStatus(status, "Accepting invite…", "");
    await apiFetch("/org-accept-invite", { method:"POST", body: JSON.stringify({ token }) });
    setStatus(status, "Invite accepted. You now have access to the organization.", "ok");
  }catch(err){
    const msg = (err && err.data && err.data.error) ? err.data.error : (err.message || "Failed");
    setStatus(status, msg, "danger");
  }
})();