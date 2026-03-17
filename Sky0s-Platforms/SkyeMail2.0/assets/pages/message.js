(async () => {
  const _me0 = await requireMe();
  if(!_me0) return;

  const meta = qs("#meta");
  const status = qs("#status");
  const subjEl = qs("#subject");
  const bodyEl = qs("#body");
  const attachmentsEl = qs("#attachments");
  const budgetEl = qs("#budget");

  qs("#btnLogout").addEventListener("click", logout);

  const url = new URL(location.href);
  const id = url.searchParams.get("id");
  if(!id){
    meta.textContent = "Missing message id.";
    return;
  }

  let me = null;
  let msg = null;
  let decrypted = null;
  let privateKey = null;
  let streamingAbort = null;

  function addChat(role, content){
    const log = qs("#chatlog");
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<div class="role">${safe(role)}</div><div class="content">${safe(content)}</div>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function setBudgetFromMonth(month){
    if(!month){ budgetEl.textContent = "Budget: —"; return; }
    const rem = remainingBudget(month);
    budgetEl.textContent = `Budget: ${month.spent_cents} / ${month.cap_cents} cents • Remaining: ${rem} cents`;
  }

  async function load(){
    me = await getMe(true);
    msg = await apiFetch("/messages-get?id=" + encodeURIComponent(id));
    meta.textContent = `From: ${(msg.from_name || msg.from_email || "Unknown")} • Received: ${fmtDate(msg.created_at)}`;
  }

  function renderAttachmentRow(a){
    const id = a.id;
    const name = a.filename || "attachment";
    const size = Number(a.size_bytes || 0);
    const mime = a.mime_type || "application/octet-stream";
    const pretty = size ? (size >= 1024*1024 ? (Math.round(size/1024/1024*10)/10 + " MB") : (Math.round(size/1024) + " KB")) : "";

    const row = document.createElement("div");
    row.className = "attRow";

    const left = document.createElement("div");
    left.className = "attLeft";

    const title = document.createElement("div");
    title.className = "attName";
    title.textContent = name;

    const meta = document.createElement("div");
    meta.className = "sub attMeta";
    meta.textContent = `${mime} • ${pretty}`.trim();

    left.appendChild(title);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "btn gold";
    btn.textContent = "Download";
    btn.addEventListener("click", async () => {
      if(!privateKey){
        setStatus(status, "Unlock required to download attachments.", "danger");
        return;
      }
      try{
        setStatus(status, "Downloading attachment…", "");
        const r = await apiFetch(`/attachments-get?id=${encodeURIComponent(id)}`);
        const plain = await CryptoVault.decryptAttachmentWithPrivateKey(privateKey, {
          encrypted_key_b64: r.encrypted_key_b64,
          iv_b64: r.iv_b64,
          ciphertext_b64: r.ciphertext_b64,
        });
        CryptoVault.downloadBytes(plain.bytes, name);
        setStatus(status, "Attachment downloaded.", "ok");
      }catch(e){
        setStatus(status, e.message || "Failed to download.", "danger");
      }
    });

    row.appendChild(left);
    row.appendChild(btn);
    return row;
  }

  async function renderAttachments(){
    attachmentsEl.innerHTML = "";
    const list = Array.isArray(msg.attachments) ? msg.attachments : [];
    if(!list.length){
      attachmentsEl.innerHTML = `<div class="sub">No attachments.</div>`;
      return;
    }
    for(const a of list){
      attachmentsEl.appendChild(renderAttachmentRow(a));
    }
  }

  qs("#btnLock").addEventListener("click", () => {
    decrypted = null;
    privateKey = null;
    subjEl.textContent = "(locked)";
    bodyEl.textContent = "(locked)";
    attachmentsEl.innerHTML = "";
    setStatus(status, "Locked.", "");
  });

  qs("#btnDecrypt").addEventListener("click", async () => {
    const pass = qs("#vaultPass").value || "";
    if(pass.length < 10){
      setStatus(status, "Vault Passphrase required (10+ chars).", "danger");
      return;
    }
    try{
      setStatus(status, "Unlocking vault…", "");

      const kv = Number(msg.key_version || 0);
      const rec = getKeyRecordByVersion(me, kv) || getActiveKeyRecord(me);
      if(!rec || !rec.vault_wrap_json){
        throw new Error("Missing vault key material for key version v" + kv);
      }

      const out = await CryptoVault.unwrapPrivateKeyWithPassphrase(rec.vault_wrap_json, pass);
      privateKey = out.privateKey;

      setStatus(status, "Decrypting…", "");
      decrypted = await CryptoVault.hybridDecryptWithPrivateKey(privateKey, msg.encrypted_key_b64, msg.iv_b64, msg.ciphertext_b64);
      subjEl.textContent = decrypted.subject || "(no subject)";
      bodyEl.textContent = decrypted.message || "(empty)";

      await renderAttachments();

      setStatus(status, "Decrypted.", "ok");
    }catch(err){
      setStatus(status, "Failed to decrypt. Wrong passphrase or message corrupted.", "danger");
    }
  });

  qs("#btnDelete").addEventListener("click", async () => {
    if(!confirm("Delete this message? This cannot be undone.")) return;
    try{
      await apiFetch("/messages-delete", { method:"POST", body: JSON.stringify({ id }) });
      location.href = "/dashboard.html";
    }catch(err){
      alert(err.message || "Delete failed.");
    }
  });

  // AI panel
  qs("#kaixuKey").value = kaixuKeyGet();
  qs("#kaixuKey").addEventListener("input", (e) => kaixuKeySet(e.target.value || ""));

  qs("#btnStop").addEventListener("click", () => {
    if(streamingAbort){ streamingAbort.abort(); streamingAbort = null; }
  });

  async function runAi(task){
    if(!decrypted){
      addChat("system", "Decrypt the message first, then run AI.");
      return;
    }

    const provider = qs("#provider").value;
    const model = (qs("#model").value || "").trim();
    const systemPrompt = qs("#systemPrompt").value || "";
    const kaixuKey = kaixuKeyGet();

    const userContent = task === "summarize"
      ? `Summarize this message precisely. Then list the key action items.\n\nMESSAGE:\n${decrypted.message}`
      : `Draft a professional reply email. Keep it concise, high-integrity, and execution-first.\n\nMESSAGE:\n${decrypted.message}`;

    const messages = [
      { role:"system", content: systemPrompt },
      { role:"user", content: userContent }
    ];

    const outDiv = addChat("assistant", "");
    let accum = "";

    try{
      // streaming required pattern: fetch + ReadableStream parsing inside kaixuStreamChat
      streamingAbort = new AbortController();
      const originalFetch = window.fetch;
      window.fetch = (input, init={}) => {
        // Inject abort signal into the gateway stream request only
        if(typeof input === "string" && input.includes("/gateway-stream")){
          init.signal = streamingAbort.signal;
        }
        return originalFetch(input, init);
      };

      await kaixuStreamChat({
        provider, model, messages,
        max_tokens: 700,
        temperature: 0.35,
        kaixuKey,
        onMeta: (m) => { if(m && m.month) setBudgetFromMonth(m.month); },
        onDelta: (d) => {
          if(d && typeof d.text === "string"){
            accum += d.text;
            outDiv.querySelector(".content").textContent = accum;
          }
        },
        onDone: (d) => {
          if(d && d.month) setBudgetFromMonth(d.month);
          streamingAbort = null;
        },
        onError: (e) => {
          streamingAbort = null;
          const msg = (e && e.error) ? e.error : "Unknown streaming error.";
          addChat("error", msg);
        }
      });

      window.fetch = originalFetch;

    }catch(err){
      streamingAbort = null;
      if(err.status === 401) addChat("error", "401: Enter your Kaixu Key.");
      else if(err.status === 402) addChat("error", "Monthly cap reached. Further calls blocked until upgraded/top-up.");
      else if(err.status === 429) addChat("error", "Rate limited. Retry after a short pause.");
      else addChat("error", err.message || "Gateway error.");
    }
  }

  qs("#btnSummarize").addEventListener("click", () => runAi("summarize"));
  qs("#btnDraft").addEventListener("click", () => runAi("draft"));

  try{
    await load();
  }catch(err){
    if(err.status === 401){
      location.href="/login.html";
      return;
    }
    meta.textContent = err.message || "Failed to load.";
  }
})();
