(async () => {
  const who = qs("#who");
  const rows = qs("#rows");
  const status = qs("#status");

  qs("#btnLogout").addEventListener("click", logout);

  const me = await requireMe();
  if(!me) return;
  who.textContent = `${me.handle} • ${me.email} • role: ${me.org_role || "—"}`;

  async function load(){
    try{
      setStatus(status, "Loading…", "");
      const data = await apiFetch("/org-me");
      if(!data.org){
        rows.innerHTML = `<tr><td colspan="4" class="mono">No organization assigned.</td></tr>`;
        setStatus(status, "No organization found for this account.", "danger");
        return;
      }
      const members = data.members || [];
      rows.innerHTML = members.map(m => `<tr>
        <td class="mono">${safe(m.role||"")}</td>
        <td class="mono">@${safe(m.handle||"")}</td>
        <td>${safe(m.email||"")}</td>
        <td class="mono">${safe(fmtDate(m.created_at))}</td>
      </tr>`).join("");
      setStatus(status, `Loaded ${members.length} members.`, "ok");
    }catch(err){
      if(err && err.status === 401){ location.href="/login.html"; return; }
      setStatus(status, err.message || "Failed.", "danger");
      rows.innerHTML = `<tr><td colspan="4" class="mono">Failed to load.</td></tr>`;
    }
  }

  qs("#btnInvite").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = (qs("#inviteEmail").value || "").trim();
    const role = qs("#inviteRole").value;
    if(!email || !email.includes("@")){
      setStatus(status, "Valid invite email required.", "danger"); return;
    }
    try{
      setStatus(status, "Sending invite…", "");
      await apiFetch("/org-invite", { method:"POST", body: JSON.stringify({ email, role }) });
      qs("#inviteEmail").value = "";
      setStatus(status, "Invite sent.", "ok");
    }catch(err){
      const msg = (err && err.data && err.data.error) ? err.data.error : (err.message || "Failed");
      setStatus(status, msg, "danger");
    }
  });

  await load();
})();