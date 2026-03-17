(async () => {
  const status = qs("#status");
  const badge = qs("#toBadge");

  const url = new URL(location.href);
  const handle = (url.searchParams.get("to") || "").trim();
  if(!handle){
    badge.textContent = "Missing recipient handle.";
    setStatus(status, "Provide ?to=<handle> or use /u/<handle>.", "danger");
    return;
  }


  // Optional DLP pre-check (client-side) — for E2E encrypted submit flows
  let dlp = { action: "off", keywords: [] };
  try{
    dlp = await apiFetch("/dlp-policy-public?handle=" + encodeURIComponent(handle));
  }catch(e){}

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

  let pubPem = null;
  let keyVersion = null;

  try{
    const r = await apiFetch("/public-key?handle=" + encodeURIComponent(handle));
    pubPem = r.public_key_pem;
    keyVersion = Number(r.key_version);
    badge.textContent = `To: @${handle} (key v${keyVersion})`;
  }catch(err){
    badge.textContent = "Recipient not found.";
    setStatus(status, err.message || "Failed to resolve recipient.", "danger");
    return;
  }

  qs("#btnSend").addEventListener("click", async (e) => {
    e.preventDefault();
    setStatus(status, "Encrypting & sending…", "");

    const from_name = (qs("#from_name").value || "").trim();
    const from_email = (qs("#from_email").value || "").trim();
    const subject = (qs("#subject").value || "").trim();
    const message = (qs("#message").value || "").trim();
    const website = (qs("#website").value || "").trim(); // honeypot

    if(!from_email || !from_email.includes("@")){
      setStatus(status, "Valid sender email required.", "danger"); return;
    }
    if(!message){
      setStatus(status, "Message is required.", "danger"); return;
    }

    // DLP pre-check (keyword-based) — server cannot read ciphertext, so enforcement happens before encryption.
    if(dlp && dlp.action && dlp.action !== "off" && Array.isArray(dlp.keywords) && dlp.keywords.length){
      const hay = (subject + "\n" + message).toLowerCase();
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
      const enc = await CryptoVault.hybridEncryptForRecipient(pubPem, { subject, message });

      // Attachments (encrypted in the browser)
      const files = (qs("#attachments").files || []);
      const attachments = [];
      if(files.length > 6) throw new Error("Max 6 attachments.");
      for(const f of files){
        if(f.size > 2_000_000) throw new Error("Attachment too large (max 2MB each).");
        attachments.push(await CryptoVault.encryptFileForRecipient(pubPem, f));
      }

      const out = await apiFetch("/submit-message", {
        method:"POST",
        body: JSON.stringify({
          handle,
          from_name,
          from_email,
          key_version: keyVersion,
          encrypted_key_b64: enc.encrypted_key_b64,
          iv_b64: enc.iv_b64,
          ciphertext_b64: enc.ciphertext_b64,
          attachments,
          website,
          turnstile_token
        })
      });

      const threadLink = location.origin + "/thread.html?token=" + encodeURIComponent(out.thread_token);
      qs("#threadLink").textContent = threadLink;
      qs("#threadLink").href = threadLink;

      setStatus(status, "Sent. A secure reply link was also emailed to you.", "ok");
      qs("#subject").value = "";
      qs("#message").value = "";
      qs("#attachments").value = "";
    }catch(err){
      setStatus(status, err.message || "Failed to send.", "danger");
    }
  });
})();
