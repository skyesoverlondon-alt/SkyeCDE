(async () => {
  const who = qs("#who");
  const status = qs("#status");
  const rows = qs("#rows");

  qs("#btnLogout").addEventListener("click", logout);

  try{
    const me = await requireMe();
    if(!me) return;
    who.textContent = `${me.handle} • ${me.email}`;
  }catch(e){}

  async function load(){
    setStatus(status, "Loading sessions…", "");
    rows.innerHTML = `<tr><td colspan="6" class="mono">Loading…</td></tr>`;
    try{
      const data = await apiFetch("/sessions-list");
      const cur = data.current_jti;
      const list = data.sessions || [];
      if(!list.length){
        rows.innerHTML = `<tr><td colspan="6" class="mono">No sessions found.</td></tr>`;
        setStatus(status, "Loaded.", "ok");
        return;
      }
      rows.innerHTML = list.map(s => {
        const current = (s.jti === cur) ? " (current)" : "";
        const revoked = s.revoked_at ? `Revoked: ${fmtDate(s.revoked_at)} (${safe(s.revoke_reason||"")})` : "";
        const ua = safe((s.user_agent || "").slice(0, 64));
        const ip = safe((s.ip_hash || "").slice(0, 14));
        const canRevoke = s.revoked_at ? "" : `<button class="btn danger btnRevoke" data-jti="${safe(s.jti)}">Revoke</button>`;
        return `<tr>
          <td class="monoSmall">${safe(String(s.jti))}${current}</td>
          <td>${safe(fmtDate(s.created_at))}</td>
          <td>${safe(fmtDate(s.last_seen_at))}</td>
          <td>${safe(fmtDate(s.expires_at))}</td>
          <td class="monoSmall">${ua}<br/><span class="monoSmall">${ip}</span><br/><span class="monoSmall">${safe(revoked)}</span></td>
          <td>${canRevoke}</td>
        </tr>`;
      }).join("");

      qsa(".btnRevoke").forEach(btn => {
        btn.addEventListener("click", async () => {
          const jti = btn.getAttribute("data-jti");
          if(!jti) return;
          setStatus(status, "Revoking…", "");
          try{
            await apiFetch("/sessions-revoke", { method:"POST", body: JSON.stringify({ jti }) });
            setStatus(status, "Revoked.", "ok");
            await load();
          }catch(err){
            setStatus(status, err.message || "Failed.", "danger");
          }
        });
      });

      setStatus(status, "Loaded.", "ok");
    }catch(err){
      if(err && err.status === 401){ location.href="/login.html"; return; }
      setStatus(status, err.message || "Failed.", "danger");
      rows.innerHTML = `<tr><td colspan="6" class="mono">Failed to load.</td></tr>`;
    }
  }

  await load();
})();