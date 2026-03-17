(async () => {
  const status = qs("#status");
  const meta = qs("#meta");
  const url = new URL(location.href);
  const token = (url.searchParams.get("token") || "").trim();
  if(!token){
    meta.textContent = "Missing thread token.";
    setStatus(status, "Use the secure reply link you received.", "danger");
    return;
  }

  // Optional Turnstile bot check (enterprise)
  let turnstileEnabled = false;
  try{
    const cfg = await apiFetch("/public-config");
    const siteKey = cfg && cfg.turnstile_site_key ? String(cfg.turnstile_site_key) : "";
    if(siteKey){
      turnstileEnabled = true;
      const box = qs("#turnstileBox");
      if(box){
        box.innerHTML = `<div class="cf-turnstile" data-sitekey="${safe(siteKey)}"></div>`;
      }
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
  }catch(e){}

  let recipient = null;
  try{
    recipient = await apiFetch("/thread-info?token=" + encodeURIComponent(token));
    meta.innerHTML = `Thread to <b>@${safe(recipient.handle)}</b> (key v${safe(String(recipient.key_version))})`;

  // Optional DLP pre-check (client-side) — for E2E encrypted reply flows
  let dlp = { action: "off", keywords: [] };
  try{
    dlp = await apiFetch("/dlp-policy-public?handle=" + encodeURIComponent(recipient.handle));
  }catch(e){}
  }catch(err){
    setStatus(status, err.message || "Thread not found.", "danger");
    return;
  }

  qs("#btnSend").addEventListener("click", async (e) => {
    e.preventDefault();
    setStatus(status, "Encrypting & sending…", "");

    const from_name = (qs("#from_name").value || "").trim();
    const from_email = (qs("#from_email").value || "").trim();
    const message = (qs("#message").value || "").trim();
    const website = (qs("#website").value || "").trim();

    if(!from_email || !from_email.includes("@")){
      setStatus(status, "Valid sender email required.", "danger"); return;
    }
    if(!message){
      setStatus(status, "Message is required.", "danger"); return;
    }

    // DLP pre-check (keyword-based)
    if(dlp && dlp.action && dlp.action !== "off" && Array.isArray(dlp.keywords) && dlp.keywords.length){
      const hay = (message).toLowerCase();
      const hits = dlp.keywords.filter(k => k && hay.includes(String(k).toLowerCase())).slice(0, 10);
      if(hits.length){
        if(dlp.action === "block"){
          setStatus(status, "Blocked by recipient DLP policy. Remove sensitive terms and try again.", "danger");
          return;
        }
        const ok = confirm("Warning: recipient DLP policy detected potential sensitive terms: " + hits.join(", ") + ".\n\nSend anyway?");
        if(!ok){
          setStatus(status, "Canceled.", "");
          return;
        }
      }
    }

    let turnstile_token = "";
    if(turnstileEnabled){
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      turnstile_token = el ? (el.value || "") : "";
      if(!turnstile_token){
        setStatus(status, "Please complete the bot check.", "danger"); return;
      }
    }

    try{
      const enc = await CryptoVault.hybridEncryptForRecipient(recipient.public_key_pem, {
        subject: "Thread Reply",
        message
      });

      const files = (qs("#attachments").files || []);
      const attachments = [];
      if(files.length > 6) throw new Error("Max 6 attachments.");
      for(const f of files){
        if(f.size > 2_000_000) throw new Error("Attachment too large (max 2MB each).");
        attachments.push(await CryptoVault.encryptFileForRecipient(recipient.public_key_pem, f));
      }

      await apiFetch("/thread-reply", {
        method:"POST",
        body: JSON.stringify({
          token,
          from_name,
          from_email,
          key_version: recipient.key_version,
          encrypted_key_b64: enc.encrypted_key_b64,
          iv_b64: enc.iv_b64,
          ciphertext_b64: enc.ciphertext_b64,
          attachments,
          website,
          turnstile_token
        })
      });

      setStatus(status, "Sent.", "ok");
      qs("#message").value = "";
      qs("#attachments").value = "";
    }catch(err){
      setStatus(status, err.message || "Failed to send.", "danger");
    }
  });
})();
