(async () => {
  const status = qs("#status");
  qs("#btnSend").addEventListener("click", async (e) => {
    e.preventDefault();
    const ident = (qs("#ident").value || "").trim();
    setStatus(status, "Sending…", "");
    try{
      await apiFetch("/auth-request-reset", { method:"POST", body: JSON.stringify({ ident }) });
      setStatus(status, "If an account exists, a reset link was sent.", "ok");
    }catch(err){
      setStatus(status, err.message || "Failed.", "danger");
    }
  });
})();
