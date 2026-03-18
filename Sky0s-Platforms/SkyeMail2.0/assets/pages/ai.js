(() => {
  const chatlog = qs("#chatlog");
  const status = qs("#status");
  const budget = qs("#budget");

  let history = [];
  let streamingAbort = null;

  function add(role, content){
    history.push({ role, content });
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<div class="role">${safe(role)}</div><div class="content">${safe(content)}</div>`;
    chatlog.appendChild(div);
    chatlog.scrollTop = chatlog.scrollHeight;
    return div;
  }

  function setBudgetFromMonth(month){
    if(!month){ budget.textContent = "Budget: —"; return; }
    const rem = remainingBudget(month);
    budget.textContent = `Budget: ${month.spent_cents} / ${month.cap_cents} cents • Remaining: ${rem} cents`;
  }

  qs("#kaixuKey").value = kaixuKeyGet();
  qs("#kaixuKey").addEventListener("input", (e) => kaixuKeySet(e.target.value || ""));

  qs("#btnStop").addEventListener("click", () => {
    if(streamingAbort){ streamingAbort.abort(); streamingAbort = null; }
  });

  async function run(streaming){
    const provider = qs("#provider").value;
    const model = (qs("#model").value || "").trim();
    const systemPrompt = qs("#systemPrompt").value || "";
    const input = qs("#userInput").value || "";
    const key = kaixuKeyGet();

    if(!key){
      setStatus(status, "Kaixu Key required.", "danger");
      add("error", "401: Enter your Kaixu Key.");
      return;
    }
    if(!input.trim()){
      setStatus(status, "Input required.", "danger");
      return;
    }

    const messages = [
      { role:"system", content: systemPrompt },
      ...history.filter(m => m.role !== "system"),
      { role:"user", content: input }
    ];

    add("user", input);
    qs("#userInput").value = "";

    const outDiv = add("assistant", "");
    let accum = "";

    try{
      setStatus(status, streaming ? "Streaming…" : "Requesting…", "");

      if(streaming){
        streamingAbort = new AbortController();
        const originalFetch = window.fetch;
        window.fetch = (input, init={}) => {
          if(typeof input === "string" && input.includes("/v1/stream")){
            init.signal = streamingAbort.signal;
          }
          return originalFetch(input, init);
        };

        await kaixuStreamChat({
          provider, model, messages,
          max_tokens: 900,
          temperature: 0.35,
          kaixuKey: key,
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
            history.push({ role:"assistant", content: accum });
            setStatus(status, "Done.", "ok");
          },
          onError: (e) => {
            streamingAbort = null;
            add("error", (e && e.error) ? e.error : "Stream error");
            setStatus(status, "Stream error.", "danger");
          }
        });

        window.fetch = originalFetch;

      }else{
        const out = await kaixuChat({
          provider, model, messages,
          max_tokens: 900,
          temperature: 0.35,
          kaixuKey: key
        });
        outDiv.querySelector(".content").textContent = out.output_text || "";
        history.push({ role:"assistant", content: out.output_text || "" });
        if(out.month) setBudgetFromMonth(out.month);
        setStatus(status, "Done.", "ok");
      }

    }catch(err){
      if(err.status === 401) { add("error", "401: Enter your Kaixu Key."); setStatus(status, "401.", "danger"); }
      else if(err.status === 402) { add("error", "Monthly cap reached. Further calls blocked until upgraded/top-up."); setStatus(status, "402.", "danger"); }
      else if(err.status === 429) { add("error", "Rate limited. Retry after a short pause."); setStatus(status, "429.", "danger"); }
      else { add("error", err.message || "Gateway error."); setStatus(status, "Error.", "danger"); }
    }
  }

  qs("#btnStream").addEventListener("click", () => run(true));
  qs("#btnNonStream").addEventListener("click", () => run(false));
})();
