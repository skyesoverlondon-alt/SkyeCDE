(async () => {
  const who = qs("#who");
  const statusLine = qs("#statusLine");
  const runLine = qs("#runLine");
  const alertLine = qs("#alertLine");
  const outboxRows = qs("#outboxRows");
  const formStatus = qs("#formStatus");

  qs("#btnLogout").addEventListener("click", logout);

  function val(id){ return (qs("#"+id).value || "").trim(); }
  function setVal(id,v){ qs("#"+id).value = (v === null || v === undefined) ? "" : String(v); }

  async function load(){
    const me = await requireMe();
    if(!me) return;
    who.textContent = `${me.handle} • ${me.email}`;

    const stats = await apiFetch("/siem-stats");
    setStatus(statusLine, stats.summary || "OK", stats.ok ? "ok" : "danger");

    runLine.textContent = stats.last_run ? `Last run: ${fmtDate(stats.last_run.ran_at)} • sent=${stats.last_run.sent} • failed=${stats.last_run.failed} • ${stats.last_run.duration_ms}ms`
                                       : "Last run: (none yet)";
    alertLine.textContent = stats.last_alert ? `Last alert: ${fmtDate(stats.last_alert.sent_at)} • ${stats.last_alert.alert_type} • ${stats.last_alert.status}`
                                             : "Last alert: (none)";

    outboxRows.innerHTML = (stats.outbox_metrics || []).map(x => `<tr><td>${safe(x.k)}</td><td class="mono">${safe(String(x.v))}</td></tr>`).join("");

    const cfg = await apiFetch("/siem-alert-config-get");
    if(cfg && cfg.config){
      setVal("enabled", cfg.config.enabled ? "true":"false");
      setVal("webhook_kind", cfg.config.webhook_kind || "generic");
      setVal("webhook_url", ""); // do not reveal
      setVal("email_to", cfg.config.email_to || "");
      setVal("threshold_failed", cfg.config.threshold_failed || 5);
      setVal("threshold_backlog", cfg.config.threshold_backlog || 200);
      setVal("threshold_oldest_minutes", cfg.config.threshold_oldest_minutes || 30);
      setVal("cooldown_minutes", cfg.config.cooldown_minutes || 60);
      setVal("notify_on_recovery", cfg.config.notify_on_recovery ? "true":"false");
      formStatus.textContent = cfg.config.has_webhook ? "Webhook is configured (hidden)." : "No webhook configured.";
    }else{
      formStatus.textContent = "No alert config yet.";
    }
  }

  qs("#btnSave").addEventListener("click", async (e) => {
    e.preventDefault();
    setStatus(formStatus, "Saving…", "");
    try{
      await apiFetch("/siem-alert-config-set", {
        method:"POST",
        body: JSON.stringify({
          enabled: val("enabled") === "true",
          webhook_kind: val("webhook_kind"),
          webhook_url: val("webhook_url"),
          email_to: val("email_to"),
          threshold_failed: Number(val("threshold_failed")||5),
          threshold_backlog: Number(val("threshold_backlog")||200),
          threshold_oldest_minutes: Number(val("threshold_oldest_minutes")||30),
          cooldown_minutes: Number(val("cooldown_minutes")||60),
          notify_on_recovery: val("notify_on_recovery") === "true"
        })
      });
      setVal("webhook_url","");
      setStatus(formStatus, "Saved.", "ok");
      await load();
    }catch(err){
      setStatus(formStatus, err.message || "Save failed.", "danger");
    }
  });

  qs("#btnTest").addEventListener("click", async (e) => {
    e.preventDefault();
    setStatus(formStatus, "Sending test…", "");
    try{
      await apiFetch("/siem-alert-fire", { method:"POST", body:"{}" });
      setStatus(formStatus, "Test alert sent (if configured).", "ok");
      await load();
    }catch(err){
      setStatus(formStatus, err.message || "Test failed.", "danger");
    }
  });

  await load();
})();