(() => {
  "use strict";

  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  let currentUser = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1600);
  }

  async function request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
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

  function setStatus(message) {
    const status = document.getElementById("statusText");
    if (status) {
      status.textContent = message;
      status.style.display = message ? "block" : "none";
    }
  }

  function setMode(mode) {
    document.body.setAttribute("data-mode", mode);
    document.querySelectorAll("[data-mode-target]").forEach((el) => {
      el.hidden = el.getAttribute("data-mode-target") !== mode;
    });
    document.querySelectorAll("[data-switch-mode]").forEach((button) => {
      button.dataset.active = button.getAttribute("data-switch-mode") === mode ? "1" : "0";
    });
    setStatus("");
  }

  async function refreshSession() {
    try {
      const data = await request("/sole-contractor-me");
      currentUser = data.user || null;
      if (!currentUser) throw new Error("No session.");
      const signedInAs = document.getElementById("signedInAs");
      if (signedInAs) signedInAs.textContent = `${currentUser.email || "—"} (${currentUser.status || "pending"})`;
      document.getElementById("sessionEmail").textContent = currentUser.email || "—";
      document.getElementById("sessionStatus").textContent = currentUser.status || "pending";
      document.getElementById("sessionCard").hidden = false;
      document.getElementById("authShell").hidden = true;
      return true;
    } catch (_) {
      currentUser = null;
      const signedInAs = document.getElementById("signedInAs");
      if (signedInAs) signedInAs.textContent = "No active session.";
      document.getElementById("sessionCard").hidden = true;
      document.getElementById("authShell").hidden = false;
      return false;
    }
  }

  async function handleSignup() {
    const email = String(document.getElementById("signupEmail").value || "").trim();
    const password = String(document.getElementById("signupPassword").value || "");
    const company = String(document.getElementById("signupCompany").value || "").trim();
    const inviteCode = String(document.getElementById("signupInviteCode").value || "").trim();
    if (!email || !password) {
      setStatus("Email and password are required.");
      toast("Missing signup fields.");
      return;
    }
    try {
      await request("/sole-contractor-signup", {
        method: "POST",
        body: JSON.stringify({ email, password, company, inviteCode })
      });
      toast("Account created.");
      setStatus("Account created. Ops approval may still be required before the app unlocks.");
      await refreshSession();
    } catch (error) {
      setStatus(error.message || "Signup failed.");
      toast("Signup failed.");
    }
  }

  async function handleLogin() {
    const email = String(document.getElementById("loginEmail").value || "").trim();
    const password = String(document.getElementById("loginPassword").value || "");
    if (!email || !password) {
      setStatus("Email and password are required.");
      toast("Missing login fields.");
      return;
    }
    try {
      await request("/sole-contractor-login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      toast("Signed in.");
      setStatus("");
      await refreshSession();
    } catch (error) {
      setStatus(error.message || "Login failed.");
      toast("Login failed.");
    }
  }

  async function handleLogout() {
    try {
      await request("/sole-contractor-logout", { method: "POST" });
    } catch (_) {}
    toast("Signed out.");
    await refreshSession();
    setMode("login");
  }

  document.querySelectorAll("[data-switch-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.getAttribute("data-switch-mode")));
  });

  document.getElementById("signupBtn").addEventListener("click", handleSignup);
  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  ["logoutHeroBtn", "logoutSessionBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", handleLogout);
  });
  ["openAppAuthBtn", "openAppSessionBtn"].forEach((id) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  });

  ["signupEmail", "signupPassword", "signupCompany", "signupInviteCode", "loginEmail", "loginPassword"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (id.startsWith("signup")) handleSignup();
      else handleLogin();
    });
  });

  setMode("login");
  refreshSession().catch(() => {});
})();
