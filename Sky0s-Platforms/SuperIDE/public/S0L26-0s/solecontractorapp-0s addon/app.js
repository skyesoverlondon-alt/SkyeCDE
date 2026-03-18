/* SOLE Sales App — Standalone PWA — Neon contractor lane — v6.1.0 */
(() => {
  "use strict";

  const APP_VERSION = "v6.1.0";
  const API_BASE = "/api";
  const STAGES = [
    "New Lead (Unworked)",
    "Attempting Contact",
    "Connected (Conversation Started)",
    "Fit Check Scheduled (10 min)",
    "Fit Check Completed — PASS",
    "Discovery Scheduled (30–45 min)",
    "Discovery Completed",
    "Demo Scheduled",
    "Demo Completed",
    "Proposal Sent",
    "Verbal Yes / Pending Deposit",
    "Closed Won (Deposit Paid)",
    "Closed Lost",
    "Disqualified"
  ];
  const DEFAULT_TEMPLATES = [
    {
      id: "dm-phoenix-local-free-revamp-hook",
      channel: "DM",
      title: "Phoenix Local — Free Revamp Hook",
      text:
`Yo — I’m local (Phoenix/Glendale) and I do agency-level web builds.

I just did a complimentary revamp for a business as a welcome package — and it reminded me of your brand.

If I rebuilt your site to look like a premium portal (fast, mobile-perfect, high trust), would you want to see a 60-second demo?

If yes, drop the best email and I’ll send the demo link.`
    },
    {
      id: "dm-straight-offer-fit-check",
      channel: "DM",
      title: "Straight Offer — 10 min Fit Check",
      text:
`Quick one: are you the owner/decision maker?

If yes — I can do a 10-minute fit check and tell you exactly what’s costing you leads on mobile + what a premium rebuild would look like.

No fluff. Want to book it this week?`
    },
    {
      id: "sms-short-text-fit-check",
      channel: "SMS",
      title: "Short Text — Book Fit Check",
      text:
`Hey — this is {rep} with Skyes Over London LC. Quick question: are you the owner/decision maker for {business}? If yes, I can do a 10-min fit check and show what we’d rebuild to increase calls/leads.`
    },
    {
      id: "call-opener-frame",
      channel: "CALL",
      title: "Opener — Permission + Frame",
      text:
`Hey {name}, it’s {rep} — I’ll be fast.

I’m calling because we build agency-level sites that feel engineered (not templated), and I noticed a couple of mobile trust leaks on yours.

Do you have 60 seconds so I can tell you what I saw, and if it’s worth a 10-minute fit check?`
    },
    {
      id: "objection-web-guy",
      channel: "OBJECTIONS",
      title: "We already have a web guy",
      text:
`Totally fine — I’m not trying to replace anyone.

What I’m offering is a benchmark: we’ll show you what a premium rebuild looks like, what it would change for conversion, and what the gaps are.

If your guy can match it, win. If not, you have options.

Fair to do a 10-minute fit check?`
    },
    {
      id: "close-lock-next-step",
      channel: "CLOSE",
      title: "Close — Lock the Next Step",
      text:
`Perfect. Next step is simple:

1) 10-minute fit check.
2) If it’s a pass, we schedule the deeper call.

What’s better — tomorrow morning or tomorrow afternoon?`
    }
  ];
  const PIN_GATE = {
    enabled: true,
    pin: "7392",
    sessionHours: 6
  };
  const ACCESS = { requireApproved: true };

  let pinMemoryToken = null;
  let user = null;
  let leads = [];
  let activeLead = null;
  let templatesCache = null;
  let leadPollTimer = null;

  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");
  let toastTimer = null;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1600);
  }

  async function request(path, options = {}) {
    const response = await fetch(API_BASE + path, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (_) {
      data = { error: raw || "Request failed." };
    }
    if (!response.ok || data.error) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }
    return data;
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update().catch(() => {});
    }).catch(() => {});
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  function openModal(modalId) {
    const modal = $(modalId);
    const backdrop = $("modalBackdrop");
    if (!modal || !backdrop) return;
    backdrop.hidden = false;
    modal.hidden = false;
    setTimeout(() => {
      const focusable = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (focusable) focusable.focus();
    }, 0);
  }

  function closeModal(modalId) {
    const modal = $(modalId);
    const backdrop = $("modalBackdrop");
    if (!modal || !backdrop) return;
    modal.hidden = true;
    const anyOpen = ["installModal", "templatesModal"].some((id) => !$(id).hidden);
    backdrop.hidden = anyOpen;
  }

  function closeAllModals() {
    closeModal("installModal");
    closeModal("templatesModal");
  }

  $("modalBackdrop").addEventListener("click", closeAllModals);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  (function swipeCloseInstall() {
    const card = $("installCard");
    if (!card) return;
    let startY = 0;
    let startX = 0;
    let active = false;
    card.addEventListener("pointerdown", (e) => {
      active = true;
      startY = e.clientY;
      startX = e.clientX;
    });
    card.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dy = e.clientY - startY;
      const dx = Math.abs(e.clientX - startX);
      if (dy > 90 && dx < 40) {
        active = false;
        closeModal("installModal");
      }
    });
    card.addEventListener("pointerup", () => { active = false; });
    card.addEventListener("pointercancel", () => { active = false; });
  })();

  function showInstallTips(force = false) {
    if (!force) {
      if (localStorage.getItem("SOLE_INSTALL_NEVER") === "1") return;
      if (localStorage.getItem("SOLE_INSTALL_DISMISSED") === "1") return;
    }
    openModal("installModal");
  }

  $("installBtn").addEventListener("click", () => showInstallTips(true));
  $("installClose").addEventListener("click", () => closeModal("installModal"));
  $("installDismiss").addEventListener("click", () => {
    localStorage.setItem("SOLE_INSTALL_DISMISSED", "1");
    closeModal("installModal");
  });
  $("installNever").addEventListener("click", () => {
    localStorage.setItem("SOLE_INSTALL_NEVER", "1");
    closeModal("installModal");
  });

  function setView(view) {
    document.body.setAttribute("data-view", view);
    $("navPipeline").dataset.active = view === "pipeline" ? "1" : "0";
    $("navLead").dataset.active = view === "lead" ? "1" : "0";
    $("navControl").dataset.active = view === "control" ? "1" : "0";
  }

  $("navPipeline").addEventListener("click", () => setView("pipeline"));
  $("navLead").addEventListener("click", () => setView("lead"));
  $("navControl").addEventListener("click", () => setView("control"));

  function pad(n) { return String(n).padStart(2, "0"); }
  function localInputFromDate(date) {
    if (!date || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function localInputFromTS(value) {
    if (!value) return "";
    const date = new Date(value);
    return localInputFromDate(date);
  }
  function tsFromLocalInput(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  function fmtTS(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function pinTokenValid() {
    let raw = null;
    try { raw = localStorage.getItem("SOLE_PIN_TOKEN"); } catch (_) { raw = null; }
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data && data.exp && Date.now() < data.exp) return true;
      } catch (_) {}
    }
    return Boolean(pinMemoryToken && pinMemoryToken.exp && Date.now() < pinMemoryToken.exp);
  }

  function setPinToken() {
    const exp = Date.now() + PIN_GATE.sessionHours * 3600 * 1000;
    const payload = JSON.stringify({ exp });
    try {
      localStorage.setItem("SOLE_PIN_TOKEN", payload);
    } catch (_) {
      pinMemoryToken = { exp };
    }
  }

  function clearPinToken() {
    try { localStorage.removeItem("SOLE_PIN_TOKEN"); } catch (_) {}
    pinMemoryToken = null;
  }

  function showPinGate() {
    $("pinGate").hidden = false;
    $("auth").hidden = true;
    $("main").hidden = true;
  }
  function showAuth() {
    $("pinGate").hidden = true;
    $("auth").hidden = false;
    $("main").hidden = true;
  }
  function showMain() {
    $("pinGate").hidden = true;
    $("auth").hidden = true;
    $("main").hidden = false;
  }

  $("pinUnlockBtn").addEventListener("click", async () => {
    const pin = String($("pinInput").value || "").trim();
    if (!pin) {
      $("pinMsg").textContent = "Enter the PIN.";
      toast("PIN required.");
      return;
    }
    if (pin !== PIN_GATE.pin) {
      $("pinMsg").textContent = "Invalid PIN.";
      $("pinInput").value = "";
      toast("Invalid PIN.");
      return;
    }
    setPinToken();
    $("pinMsg").textContent = "";
    const sessionOk = await refreshSession();
    if (!sessionOk) {
      showAuth();
      $("authEmail").focus();
    }
  });

  $("pinClearBtn").addEventListener("click", () => {
    $("pinInput").value = "";
    $("pinInput").focus();
  });
  $("pinInput").addEventListener("input", () => { $("pinMsg").textContent = ""; });
  $("pinInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("pinUnlockBtn").click();
  });

  const keypad = $("pinKeypad");
  if (keypad) {
    keypad.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-k]");
      if (!button) return;
      const key = button.getAttribute("data-k");
      const input = $("pinInput");
      if (key === "back") input.value = input.value.slice(0, -1);
      else if (key === "clear") input.value = "";
      else if (input.value.length < 12) input.value += key;
      $("pinMsg").textContent = "";
      input.focus();
    });
  }

  function stopLeadPolling() {
    if (leadPollTimer) clearInterval(leadPollTimer);
    leadPollTimer = null;
  }

  async function refreshSession() {
    try {
      const data = await request("/sole-contractor-me");
      user = data.user || null;
      $("me").textContent = user ? user.email : "—";
      if (!user) throw new Error("No session.");
      if (ACCESS.requireApproved && String(user.status || "pending").toLowerCase() !== "approved") {
        showAuth();
        $("authMsg").textContent = "Account is pending approval. Ask ops to approve your contractor access.";
        toast("Pending approval.");
        return false;
      }
      showMain();
      setView("pipeline");
      await fetchLeads();
      startLeadPolling();
      maybeAutoInstallTips();
      return true;
    } catch (_) {
      user = null;
      $("me").textContent = "—";
      stopLeadPolling();
      clearLeadSelection();
      return false;
    }
  }

  $("authBtn").addEventListener("click", async () => {
    const email = String($("authEmail").value || "").trim();
    const password = String($("authPass").value || "");
    if (!email || !password) {
      $("authMsg").textContent = "Enter email + password.";
      toast("Email + password required.");
      return;
    }
    $("authMsg").textContent = "";
    try {
      await request("/sole-contractor-login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      toast("Signed in.");
      await refreshSession();
    } catch (error) {
      $("authMsg").textContent = error.message || String(error);
      toast("Sign-in failed.");
    }
  });

  $("authClearBtn").addEventListener("click", () => {
    $("authEmail").value = "";
    $("authPass").value = "";
    $("authEmail").focus();
  });

  $("lockBtn").addEventListener("click", async () => {
    closeAllModals();
    try { await request("/sole-contractor-logout", { method: "POST" }); } catch (_) {}
    clearPinToken();
    stopLeadPolling();
    user = null;
    toast("Locked.");
    if (PIN_GATE.enabled) showPinGate();
    else showAuth();
  });

  function setOptions(selectEl, values, withAll = false) {
    selectEl.innerHTML = "";
    if (withAll) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "All Stages";
      selectEl.appendChild(opt);
    }
    values.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      selectEl.appendChild(opt);
    });
  }

  function escHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
  function norm(value) { return String(value || "").toLowerCase().trim(); }

  setOptions($("stage"), STAGES, false);
  setOptions($("stageFilter"), STAGES, true);
  $("q").addEventListener("input", renderKanban);
  $("stageFilter").addEventListener("change", renderKanban);

  async function fetchLeads() {
    if (!user) return;
    const data = await request("/sole-sales-leads");
    leads = Array.isArray(data.leads) ? data.leads : [];
    renderAll();
    if (activeLead) {
      const fresh = leads.find((item) => item.id === activeLead.id);
      if (fresh) {
        activeLead = fresh;
        fillLeadForm(activeLead);
        await fetchActivities(activeLead.id);
      }
    }
  }

  function startLeadPolling() {
    stopLeadPolling();
    leadPollTimer = setInterval(() => {
      fetchLeads().catch(() => {});
    }, 15000);
  }

  function renderKPIs() {
    $("kTotal").textContent = String(leads.length || 0);
    const hot = leads.filter((lead) => {
      const stage = lead.stage || "";
      return stage.includes("Proposal") || stage.includes("Verbal") || stage.includes("Closed Won");
    }).length;
    $("kHot").textContent = String(hot);
  }

  function buildLeadCard(lead) {
    const card = document.createElement("div");
    card.className = "lead";
    card.draggable = true;
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", lead.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("click", () => openLead(lead.id));
    const name = lead.businessName || "(No name)";
    const sub = [lead.city, lead.niche].filter(Boolean).join(" • ");
    const tags = [];
    if (lead.recommendedPackage) tags.push(`<span class="tag gold">${escHtml(lead.recommendedPackage)}</span>`);
    if (lead.productionInterest && lead.productionInterest !== "None") tags.push(`<span class="tag">${escHtml(lead.productionInterest)}</span>`);
    if (lead.nextStepAt) tags.push(`<span class="tag">Next: ${escHtml(localInputFromTS(lead.nextStepAt).replace("T", " "))}</span>`);
    card.innerHTML = `
      <div class="name">${escHtml(name)}</div>
      <div class="sub">${escHtml(sub || "—")}</div>
      ${tags.length ? `<div class="tagRow">${tags.join("")}</div>` : ""}
    `;
    return card;
  }

  async function moveLeadStage(leadId, stage) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || !STAGES.includes(stage)) return;
    try {
      await request("/sole-sales-leads", {
        method: "POST",
        body: JSON.stringify({ ...lead, stage })
      });
      await fetchLeads();
      toast("Moved.");
    } catch (error) {
      toast(error.message || "Move failed.");
    }
  }

  function renderKanban() {
    const kanban = $("kanban");
    kanban.innerHTML = "";
    const query = norm($("q").value);
    const stageFilter = $("stageFilter").value;
    let list = leads.slice();
    if (stageFilter) list = list.filter((lead) => (lead.stage || STAGES[0]) === stageFilter);
    if (query) {
      list = list.filter((lead) => {
        const haystack = norm([
          lead.businessName,
          lead.contactName,
          lead.city,
          lead.niche,
          lead.phone,
          lead.email,
          lead.instagram,
          lead.website
        ].join(" "));
        return haystack.includes(query);
      });
    }

    STAGES.forEach((stage) => {
      const inStage = list.filter((lead) => (lead.stage || STAGES[0]) === stage);
      const col = document.createElement("div");
      col.className = "col";
      const top = document.createElement("div");
      top.className = "colTop";
      top.innerHTML = `
        <div>
          <b>${escHtml(stage)}</b>
          <div class="count">${inStage.length} lead${inStage.length === 1 ? "" : "s"}</div>
        </div>
        <div class="count">Drop here</div>
      `;
      const stack = document.createElement("div");
      stack.className = "stack";
      stack.addEventListener("dragover", (e) => {
        e.preventDefault();
        stack.classList.add("drop");
      });
      stack.addEventListener("dragleave", () => stack.classList.remove("drop"));
      stack.addEventListener("drop", (e) => {
        e.preventDefault();
        stack.classList.remove("drop");
        const leadId = e.dataTransfer.getData("text/plain");
        if (leadId) moveLeadStage(leadId, stage);
      });
      inStage.forEach((lead) => stack.appendChild(buildLeadCard(lead)));
      col.appendChild(top);
      col.appendChild(stack);
      kanban.appendChild(col);
    });
  }

  function clearLeadSelection() {
    activeLead = null;
    $("dtTitle").textContent = "Lead";
    $("leadEmpty").hidden = false;
    $("leadForm").hidden = true;
    $("activityList").innerHTML = "";
    $("lastTouch").textContent = "—";
  }

  function showLeadForm() {
    $("leadEmpty").hidden = true;
    $("leadForm").hidden = false;
  }

  function fillLeadForm(lead) {
    if (!lead) return;
    showLeadForm();
    $("dtTitle").textContent = lead.businessName ? `Lead: ${lead.businessName}` : `Lead: ${lead.id}`;
    $("businessName").value = lead.businessName || "";
    $("contactName").value = lead.contactName || "";
    $("phone").value = lead.phone || "";
    $("email").value = lead.email || "";
    $("instagram").value = lead.instagram || "";
    $("website").value = lead.website || "";
    $("city").value = lead.city || "";
    $("niche").value = lead.niche || "";
    $("stage").value = lead.stage || STAGES[0];
    $("recommendedPackage").value = lead.recommendedPackage || "";
    $("productionInterest").value = lead.productionInterest || "";
    $("notes").value = lead.notes || "";
    $("nextStepLocal").value = localInputFromTS(lead.nextStepAt || null);
    $("nextStepWarn").hidden = Boolean($("nextStepLocal").value);
    $("lastTouch").textContent = lead.lastActivityAt ? `Last touch: ${fmtTS(lead.lastActivityAt)}` : "No activity yet";
  }

  function leadFromForm() {
    const base = activeLead ? { ...activeLead } : {};
    base.businessName = String($("businessName").value || "").trim();
    base.contactName = String($("contactName").value || "").trim();
    base.phone = String($("phone").value || "").trim();
    base.email = String($("email").value || "").trim();
    base.instagram = String($("instagram").value || "").trim();
    base.website = String($("website").value || "").trim();
    base.city = String($("city").value || "").trim();
    base.niche = String($("niche").value || "").trim();
    base.stage = $("stage").value || STAGES[0];
    base.nextStepAt = tsFromLocalInput($("nextStepLocal").value);
    base.recommendedPackage = $("recommendedPackage").value || "";
    base.productionInterest = $("productionInterest").value || "";
    base.notes = String($("notes").value || "").trim();
    return base;
  }

  async function saveLead() {
    if (!user) return;
    const data = leadFromForm();
    if (!data.businessName) {
      toast("Business name is required.");
      return;
    }
    $("nextStepWarn").hidden = Boolean($("nextStepLocal").value);
    try {
      const result = await request("/sole-sales-leads", {
        method: "POST",
        body: JSON.stringify(data)
      });
      await fetchLeads();
      if (!data.id && result.leadId) openLead(result.leadId);
      toast(data.id ? "Saved." : "Lead created.");
    } catch (error) {
      toast(error.message || "Save failed.");
    }
  }

  async function fetchActivities(leadId) {
    if (!leadId) return;
    const data = await request(`/sole-sales-activities?leadId=${encodeURIComponent(leadId)}`);
    renderActivities(Array.isArray(data.activities) ? data.activities : []);
  }

  function openLead(id) {
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;
    activeLead = lead;
    fillLeadForm(activeLead);
    fetchActivities(activeLead.id).catch(() => {});
    if (window.matchMedia("(max-width: 980px)").matches) setView("lead");
  }

  function newLead() {
    activeLead = null;
    $("dtTitle").textContent = "New Lead";
    showLeadForm();
    ["businessName", "contactName", "phone", "email", "instagram", "website", "city", "niche", "notes"].forEach((id) => {
      $(id).value = "";
    });
    $("stage").value = STAGES[0];
    $("nextStepLocal").value = "";
    $("recommendedPackage").value = "";
    $("productionInterest").value = "";
    $("nextStepWarn").hidden = false;
    $("activityList").innerHTML = "";
    $("lastTouch").textContent = "—";
    if (window.matchMedia("(max-width: 980px)").matches) setView("lead");
  }

  $("newBtn").addEventListener("click", newLead);
  $("saveBtn").addEventListener("click", saveLead);
  $("discardBtn").addEventListener("click", () => {
    if (activeLead) {
      const fresh = leads.find((item) => item.id === activeLead.id);
      if (fresh) {
        activeLead = fresh;
        fillLeadForm(activeLead);
      }
    } else {
      clearLeadSelection();
    }
    toast("Discarded.");
  });
  $("nextStepLocal").addEventListener("change", () => {
    $("nextStepWarn").hidden = Boolean($("nextStepLocal").value);
  });

  function renderActivities(items) {
    const list = $("activityList");
    list.innerHTML = "";
    if (!items || !items.length) {
      list.innerHTML = `
        <div class="item">
          <b>No activity yet</b>
          <div class="t">Log calls, texts, and DMs to keep history tight.</div>
        </div>`;
      return;
    }
    items.forEach((item) => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <b>${escHtml(item.channel || "Activity")}</b>
        <div class="t">${escHtml(fmtTS(item.createdAt || ""))}</div>
        <div class="n">${escHtml(item.note || "")}</div>
      `;
      list.appendChild(div);
    });
  }

  async function logActivity(channel) {
    if (!activeLead) {
      toast("Open a lead first.");
      return;
    }
    const note = prompt(`${channel} note:`, "");
    if (note === null) return;
    try {
      await request("/sole-sales-activities", {
        method: "POST",
        body: JSON.stringify({ leadId: activeLead.id, channel, note })
      });
      await fetchLeads();
      await fetchActivities(activeLead.id);
      toast("Logged.");
    } catch (error) {
      toast(error.message || "Log failed.");
    }
  }

  $("logCallBtn").addEventListener("click", () => logActivity("Call"));
  $("logTextBtn").addEventListener("click", () => logActivity("Text"));
  $("logDMBtn").addEventListener("click", () => logActivity("Instagram DM"));

  function downloadCSV(rows) {
    if (!rows.length) return;
    const headers = [
      "id", "businessName", "contactName", "phone", "email", "instagram", "website", "city", "niche",
      "stage", "recommendedPackage", "productionInterest", "nextStepAt", "lastActivityAt", "createdAt", "updatedAt", "notes"
    ];
    const esc = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((header) => esc(row[header])).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sole_leads.csv";
    a.click();
  }

  $("exportBtn").addEventListener("click", () => {
    if (!leads.length) {
      toast("No leads to export.");
      return;
    }
    downloadCSV(leads);
  });

  $("refreshBtn").addEventListener("click", async () => {
    try {
      await fetchLeads();
      if (activeLead) await fetchActivities(activeLead.id);
      toast("Refreshed.");
    } catch (error) {
      toast(error.message || "Refresh failed.");
    }
  });

  function downloadICS(title, startDate, durationMins) {
    const end = new Date(startDate.getTime() + durationMins * 60000);
    const fmt = (date) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    const uid = `${Date.now()}-sole@solenterprises`;
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SOLE//Sales App//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${fmt(new Date())}
DTSTART:${fmt(startDate)}
DTEND:${fmt(end)}
SUMMARY:${title}
DESCRIPTION:SOLE Sales Call
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sole_call.ics";
    a.click();
  }

  $("icsBtn").addEventListener("click", () => {
    if (!activeLead) {
      toast("Open a lead first.");
      return;
    }
    const local = $("nextStepLocal").value;
    if (!local) {
      toast("Set Next Step time first.");
      return;
    }
    const start = new Date(local);
    if (Number.isNaN(start.getTime())) {
      toast("Invalid time.");
      return;
    }
    downloadICS(`${activeLead.businessName || "Business"} — Sales Call`, start, 45);
    toast("ICS downloaded.");
  });

  $("templatesBtn").addEventListener("click", () => {
    openModal("templatesModal");
    renderTemplates();
  });
  $("templatesClose").addEventListener("click", () => closeModal("templatesModal"));
  $("templatesDone").addEventListener("click", () => closeModal("templatesModal"));
  $("tplCategory").addEventListener("change", renderTemplates);

  async function loadTemplates() {
    try {
      const data = await request("/sole-sales-templates");
      return Array.isArray(data.templates) ? data.templates : [];
    } catch (_) {
      return [];
    }
  }

  function templateListForChannel(all, channel) {
    const matches = (all || []).filter((item) => String(item.channel || "").toUpperCase() === channel.toUpperCase());
    return matches.length ? matches : DEFAULT_TEMPLATES.filter((item) => item.channel === channel);
  }

  async function renderTemplates() {
    const channel = String($("tplCategory").value || "DM").toUpperCase();
    const mount = $("tplList");
    mount.innerHTML = "";
    if (!templatesCache) templatesCache = await loadTemplates();
    const list = templateListForChannel(templatesCache, channel);
    list.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "panel";
      card.style.marginBottom = "12px";
      card.innerHTML = `
        <div class="panel__head">
          <div class="panel__title">${escHtml(item.title || "Script")}</div>
          <div class="panel__meta">
            <button class="btn btn--primary" type="button" data-copy="${idx}">Copy</button>
          </div>
        </div>
        <div class="panel__body">
          <pre style="white-space:pre-wrap;margin:0;font:13px/1.4 system-ui;color:var(--ink)">${escHtml(item.text || "")}</pre>
        </div>
      `;
      mount.appendChild(card);
    });
    mount.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const i = Number(btn.getAttribute("data-copy"));
        const active = templateListForChannel(templatesCache, channel);
        const text = active[i] ? active[i].text || "" : "";
        try {
          await navigator.clipboard.writeText(text);
          toast("Copied.");
        } catch (_) {
          toast("Copy failed.");
        }
      });
    });
  }

  $("seedBtn").addEventListener("click", async () => {
    if (!user) {
      toast("Sign in first.");
      return;
    }
    try {
      await request("/sole-sales-templates", {
        method: "POST",
        body: JSON.stringify({ templates: DEFAULT_TEMPLATES })
      });
      templatesCache = null;
      toast("Scripts seeded.");
    } catch (error) {
      toast(error.message || "Seed failed.");
    }
  });

  function renderAll() {
    renderKPIs();
    renderKanban();
    if (!activeLead) clearLeadSelection();
    else fillLeadForm(activeLead);
  }

  function maybeAutoInstallTips() {
    if (localStorage.getItem("SOLE_INSTALL_SHOWN") === "1") return;
    localStorage.setItem("SOLE_INSTALL_SHOWN", "1");
    showInstallTips(false);
  }

  function boot() {
    registerSW();
    $("brandSub").textContent = `Secure pipeline • White Neon UI • ${APP_VERSION}`;
    if (PIN_GATE.enabled && !pinTokenValid()) showPinGate();
    else showAuth();
    refreshSession().then((ok) => {
      if (!ok && PIN_GATE.enabled && !pinTokenValid()) showPinGate();
    }).catch(() => {
      if (PIN_GATE.enabled && !pinTokenValid()) showPinGate();
      else showAuth();
    });
  }

  boot();
})();
