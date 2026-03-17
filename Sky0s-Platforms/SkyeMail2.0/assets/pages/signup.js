(async () => {
  const status = qs("#status");
  const btn = qs("#btnCreate");
  const recoveryEnabledEl = qs("#recoveryEnabled");
  const recoveryNote = qs("#recoveryNote");

  let adminPublicKeyPem = null;
  try{
    const r = await apiFetch("/admin-public-key");
    if(r && r.enabled && r.public_key_pem){
      adminPublicKeyPem = r.public_key_pem;
      recoveryEnabledEl.disabled = false;
      recoveryNote.textContent = "If enabled, an admin-encrypted recovery copy of your private key is stored. If not enabled, admin cannot recover your vault.";
    }else{
      recoveryEnabledEl.checked = false;
      recoveryEnabledEl.disabled = true;
      recoveryNote.textContent = "Admin recovery is not configured on this deployment (no admin recovery public key).";
    }
  }catch(e){
    recoveryEnabledEl.checked = false;
    recoveryEnabledEl.disabled = true;
    recoveryNote.textContent = "Admin recovery is not available right now.";
  }

  function validHandle(h){
    return /^[a-z0-9][a-z0-9-]{2,31}$/i.test(h || "");
  }

  btn.addEventListener("click", async () => {
    setStatus(status, "Generating keys and creating your vault…", "");

    const handle = (qs("#handle").value || "").trim();
    const email = (qs("#email").value || "").trim();
    const password = qs("#password").value || "";
    const vaultPass = qs("#vaultPass").value || "";
    const recoveryEnabled = !!recoveryEnabledEl.checked;

    try{
      if(!validHandle(handle)) throw new Error("Handle must be 3–32 chars and use letters/numbers/dash only.");
      if(!email.includes("@")) throw new Error("Valid email required.");
      if(password.length < 10) throw new Error("Password must be at least 10 characters.");
      if(vaultPass.length < 10) throw new Error("Vault Passphrase must be at least 10 characters.");

      const kp = await CryptoVault.generateRecipientRsaKeypair();
      const vaultWrapJson = await CryptoVault.wrapPrivateKeyWithPassphrase(kp.privateKeyPem, vaultPass);

      let recoveryBlobJson = null;
      if(recoveryEnabled){
        if(!adminPublicKeyPem) throw new Error("Admin recovery is not configured on this deployment.");
        recoveryBlobJson = await CryptoVault.adminEncryptPrivateKey(adminPublicKeyPem, kp.privateKeyPem);
      }

      await apiFetch("/auth-signup", {
        method:"POST",
        body: JSON.stringify({
          handle,
          email,
          password,
          rsa_public_key_pem: kp.publicKeyPem,
          vault_wrap_json: vaultWrapJson,
          recovery_enabled: recoveryEnabled,
          recovery_blob_json: recoveryBlobJson
        })
      });

      setHandle(handle);
      setStatus(status, "Vault created. Check your email to verify, then login.", "ok");
      setTimeout(() => location.href="/login.html", 900);

    }catch(err){
      setStatus(status, err.message || "Failed.", "danger");
    }
  });
})();
