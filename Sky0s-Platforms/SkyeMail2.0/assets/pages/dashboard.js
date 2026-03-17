(async () => {
  const who = qs("#who");
  const rows = qs("#rows");
  const status = qs("#status");
  const unlockStatus = qs("#unlockStatus");
  const publicLink = qs("#publicLink");
  const publicAddressBox = qs("#publicAddressBox");

  let me = null;
  let privateKeysByVersion = null;

  function isUnlocked(){
    return privateKeysByVersion && Object.keys(privateKeysByVersion).length > 0;
  }

  qs("#btnLogout").addEventListener("click", logout);
  qs("#btnLock").addEventListener("click", () => {
    privateKeysByVersion = null;
    qs("#vaultPass").value = "";
    setStatus(unlockStatus, "Locked.", "");
    refreshList(false);
  });

  qs("#btnUnlock").addEventListener("click", async () => {
    try{
      // KMS mode: unseal keys from server (CSRF + HttpOnly cookie auth)
      if(me && me.org_key_management_mode === "kms"){
        setStatus(unlockStatus, "Unsealing keys (KMS)…", "");
        const out = await apiFetch("/kms-unseal-keys", { method:"POST", body:"{}" });
        const klist = out.keys || [];
        if(!klist.length) throw new Error("No KMS keys available.");
        privateKeysByVersion = {};
        for(const k of klist){
          privateKeysByVersion[Number(k.version)] = k.private_key_pem;
        }
        setStatus(unlockStatus, "Unlocked (KMS). Decrypting…", "ok");
        await refreshList(true);
        return;
      }

      // Passphrase mode: unwrap locally
      const pass = qs("#vaultPass").value || "";
      if(pass.length < 10){
        setStatus(unlockStatus, "Vault Passphrase required (10+ chars).", "danger");
        return;
      }
      setStatus(unlockStatus, "Unlocking vault keys…", "");
      const keys = Array.isArray(me.keys) ? me.keys : [];
      if(!keys.length) throw new Error("No vault keyring found.");

      privateKeysByVersion = {};
      for(const k of keys){
        const v = Number(k.version);
        if(!Number.isFinite(v) || v < 1) continue;
        if(!k.vault_wrap_json) continue;
        const out = await CryptoVault.unwrapPrivateKeyWithPassphrase(k.vault_wrap_json, pass);
        privateKeysByVersion[v] = out.privateKey;
      }
      if(!Object.keys(privateKeysByVersion).length) throw new Error("Failed to unlock any key versions.");

      setStatus(unlockStatus, "Unlocked. Decrypting recent subjects…", "ok");
      await refreshList(true);
      setStatus(unlockStatus, "Unlocked.", "ok");
    }catch(err){
      privateKeysByVersion = null;
      setStatus(unlockStatus, (err && err.message) ? err.message : "Failed to unlock.", "danger");
    }
  });

  async function loadMe(){
    me = await requireMe();
    if(!me) return;
    who.textContent = `${me.handle} • ${me.email}` + (me.email_verified ? "" : " • UNVERIFIED");
    setHandle(me.handle);

    const addr = location.origin + "/u/" + me.handle;
    publicLink.href = addr;

    let html = `Your public address: <span class="mono">${safe(addr)}</span><br/><a href="${safe(addr)}" target="_blank" rel="noopener">Open send page</a>`;
    try{
      const cfg = await apiFetch("/inbound-config");
      if(cfg && cfg.enabled && cfg.inbound_domain){
        const inbound = `${me.handle}@${cfg.inbound_domain}`;
        html += `<div class="hr"></div>`;
        html += `Your inbound email address: <span class="mono">${safe(inbound)}</span><br/><span class="sub">Email sent to this address is imported into your Vault inbox.</span>`;
      }
    }catch(e){}
    publicAddressBox.innerHTML = html;
  }

  async function refreshList(tryDecrypt=false){
    setStatus(status, "Loading messages…", "");
    rows.innerHTML = `<tr><td colspan="4" class="mono">Loading…</td></tr>`;

    try{
      const list = await apiFetch("/messages-list");
      const items = list.items || [];
      if(!items.length){
        rows.innerHTML = `<tr><td colspan="4" class="mono">No messages yet.</td></tr>`;
        setStatus(status, "No messages.", "");
        return;
      }

      rows.innerHTML = items.map(it => {
        const from = safe((it.from_name || it.from_email || "Unknown").trim());
        const received = safe(fmtDate(it.created_at));
        const subject = (isUnlocked() && tryDecrypt) ? "Decrypting…" : "Locked";
        return `<tr data-id="${it.id}" data-kv="${it.key_version}">
          <td>${from}</td>
          <td class="subj">${subject}</td>
          <td>${received}</td>
          <td><a class="pill" href="/message.html?id=${encodeURIComponent(it.id)}">Open</a></td>
        </tr>`;
      }).join("");

      if(isUnlocked() && tryDecrypt){
        // One batched fetch (avoids N+1)
        const batch = await apiFetch("/messages-batch?limit=50");
        const bitems = batch.items || [];
        const byId = new Map(bitems.map(x => [x.id, x]));
        const trs = Array.from(rows.querySelectorAll("tr[data-id]"));

        for(const tr of trs){
          const id = tr.getAttribute("data-id");
          const cell = tr.querySelector(".subj");
          const msg = byId.get(id);
          if(!msg){ cell.textContent = "Locked"; continue; }

          const kv = Number(msg.key_version);
          try{
            const pk = privateKeysByVersion && Number.isFinite(kv) ? privateKeysByVersion[kv] : null;
            if(!pk) throw new Error("Missing key for v" + kv);

            const payload = await CryptoVault.hybridDecryptWithPrivateKey(pk, msg.encrypted_key_b64, msg.iv_b64, msg.ciphertext_b64);
            cell.textContent = payload.subject ? String(payload.subject) : "(no subject)";

            try{
              SMVSearchIndex.upsert({
                id,
                subject: payload.subject || "",
                snippet: String(payload.message || "").slice(0, 240),
                from_email: msg.from_email || "",
                from_name: msg.from_name || "",
                created_at: msg.created_at || ""
              });
            }catch(e){}
          }catch(e){
            cell.textContent = "Locked/Corrupt";
          }
        }
      }

      setStatus(status, "Loaded.", "ok");
    }catch(err){
      if(err && err.status === 401){
        location.href = "/login.html";
        return;
      }
      setStatus(status, err.message || "Failed.", "danger");
      rows.innerHTML = `<tr><td colspan="4" class="mono">Failed to load.</td></tr>`;
    }
  }

  await loadMe();
  await refreshList(false);
})();
