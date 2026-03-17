(async () => {
  const who = qs("#who");
  const rows = qs("#rows");
  const status = qs("#status");
  const q = qs("#q");

  qs("#btnLogout").addEventListener("click", logout);
  qs("#btnRefresh").addEventListener("click", () => load());

  function rowHtml(e){
    const actor = e.actor_handle ? `@${e.actor_handle}` : (e.actor_email || "—");
    const tgt = e.target_type ? `${e.target_type}:${e.target_id || ""}` : "—";
    const ip8 = e.ip_hash ? String(e.ip_hash).slice(0, 10) + "…" : "—";
    return `<tr>
      <td class="mono">${safe(fmtDate(e.created_at))}</td>
      <td class="mono">${safe(e.action || "")}</td>
      <td>${safe(actor)}</td>
      <td class="mono">${safe(tgt)}</td>
      <td class="mono">${safe(ip8)}</td>
    </tr>`;
  }

  async function load(){
    try{
      setStatus(status, "Loading…", "");
      const data = await apiFetch("/audit-list?limit=300");
      const items = data.items || [];
      const query = (q.value || "").trim().toLowerCase();

      const filtered = query ? items.filter(e => {
        const hay = `${e.action||""} ${e.actor_handle||""} ${e.actor_email||""} ${e.target_type||""} ${e.target_id||""}`.toLowerCase();
        return hay.includes(query);
      }) : items;

      rows.innerHTML = filtered.length ? filtered.map(rowHtml).join("") : `<tr><td colspan="5" class="mono">No audit events.</td></tr>`;
      setStatus(status, `Loaded ${filtered.length} events.`, "ok");
    }catch(err){
      if(err && err.status === 401){ location.href="/login.html"; return; }
      setStatus(status, err.message || "Failed.", "danger");
      rows.innerHTML = `<tr><td colspan="5" class="mono">Failed to load.</td></tr>`;
    }
  }

  const me = await requireMe();
  if(!me) return;
  who.textContent = `${me.handle} • ${me.email}` + (me.email_verified ? "" : " • UNVERIFIED");

  await load();
})();
