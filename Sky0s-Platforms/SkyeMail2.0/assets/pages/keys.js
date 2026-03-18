(async () => {
  let me0 = null;

  qs("#btnLogout").addEventListener("click", logout);

  const who = qs("#who");
  const status = qs("#status");
  const kstatus = qs("#kstatus");
  const keysList = qs("#keysList");

  function downloadBlob(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 500);
  }

  function getFilenameFromDisposition(header){
    const raw = String(header || "");
    const utf8 = raw.match(/filename\*=UTF-8''([^;]+)/i);
    if(utf8 && utf8[1]) return decodeURIComponent(utf8[1]);
    const plain = raw.match(/filename="?([^";]+)"?/i);
    return plain && plain[1] ? plain[1] : "";
  }

  async function refreshMe(){
    const me = await requireMe();
    me0 = me;
    if(!me) return null;
    who.textContent = `${me.handle} • ${me.email} • Active key v${me.active_version}`;
    keysList.innerHTML = (me.keys || []).map(k => {
      const tag = k.is_active ? '<b class="tag active">ACTIVE</b>' : '<span class="tag inactive">inactive</span>';
      return `<div class="mono">v${k.version} — ${tag} — created ${safe(fmtDate(k.created_at))}</div>`;
    }).join("");
    return me;
  }

  qs("#btnExport").addEventListener("click", async () => {
    try{
      setStatus(status, "Exporting…", "");
      const res = await fetch("/.netlify/functions/vault-export", {
        method: "GET",
        credentials: "include"
      });
      if(!res.ok){
        const raw = await res.text();
        let message = `HTTP ${res.status}`;
        try{
          const data = raw ? JSON.parse(raw) : null;
          if(data && data.error) message = data.error;
        }catch(e){
          if(raw) message = raw;
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const fallbackHandle = me0 && me0.handle ? me0.handle : "user";
      const fallbackName = `vault-pack-${fallbackHandle}-${new Date().toISOString().slice(0,10)}.json`;
      const name = getFilenameFromDisposition(res.headers.get("Content-Disposition")) || fallbackName;
      downloadBlob(name, blob);
      setStatus(status, "Vault Pack downloaded.", "ok");
    }catch(err){
      setStatus(status, err.message || "Export failed.", "danger");
    }
  });

  qs("#btnRestore").addEventListener("click", async () => {
    try{
      setStatus(status, "Restoring…", "");
      const raw = qs("#packJson").value || "";
      const pack = JSON.parse(raw);
      await apiFetch("/vault-restore-keys", { method:"POST", body: JSON.stringify(pack) });
      qs("#packJson").value = "";
      await refreshMe();
      setStatus(status, "Keys restored.", "ok");
    }catch(err){
      setStatus(status, err.message || "Restore failed.", "danger");
    }
  });

  qs("#btnRotate").addEventListener("click", async () => {
    try{
      // KMS mode: server generates + wraps key; no passphrase required.
      if(me0 && me0.org_key_management_mode === "kms"){
        setStatus(kstatus, "Rotating (KMS)…", "");
        const out = await apiFetch("/keys-rotate", { method:"POST", body: "{}" });
        setStatus(kstatus, "Rotated. Active key v" + out.active_version, "ok");
        await refreshMe();
        return;
      }

      const pass = qs("#vaultPass").value || "";
      if(pass.length < 10) { setStatus(kstatus, "Vault Passphrase required (10+ chars).", "danger"); return; }
      setStatus(kstatus, "Generating new keypair…", "");
      const kp = await CryptoVault.generateRecipientRsaKeypair();
      const wrap = await CryptoVault.wrapPrivateKeyWithPassphrase(kp.privateKeyPem, pass);
      setStatus(kstatus, "Sending rotation…", "");
      const out = await apiFetch("/keys-rotate", { method:"POST", body: JSON.stringify({ rsa_public_key_pem: kp.publicKeyPem, vault_wrap_json: wrap }) });
      setStatus(kstatus, "Rotated. Active key v" + out.active_version, "ok");
      await refreshMe();
    }catch(err){
      setStatus(kstatus, err.message || "Rotation failed.", "danger");
    }
  });

  try{
    await refreshMe();
  }catch(err){
    if(err && err.status === 401){ location.href="/login.html"; return; }
    setStatus(status, err.message || "Failed.", "danger");
  }
})();
