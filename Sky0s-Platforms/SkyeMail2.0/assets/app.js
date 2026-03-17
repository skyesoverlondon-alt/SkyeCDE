const API_BASE = "/.netlify/functions";

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

function setStatus(el, msg, kind=""){
  if(!el) return;
  el.textContent = msg || "";
  // CSP-safe: avoid inline styles; use data-kind so CSS can style it.
  if(kind) el.setAttribute("data-kind", kind);
  else el.removeAttribute("data-kind");
}


function getHandle(){ return localStorage.getItem("SMV_HANDLE") || ""; }
function setHandle(h){ localStorage.setItem("SMV_HANDLE", h); }

function getCookie(name){
  try{
    const m = document.cookie.match(new RegExp("(^|;\\s*)" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : "";
  }catch(e){ return ""; }
}

function getCsrf(){ return getCookie("SMV_CSRF") || ""; }

async function apiFetch(path, opts = {}){
  const method = (opts.method || "GET").toUpperCase();
  const headers = Object.assign({ "Content-Type":"application/json" }, opts.headers || {});
  const csrf = getCsrf();
  if(csrf && method !== "GET" && method !== "HEAD" && method !== "OPTIONS"){
    headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(API_BASE + path, Object.assign({}, opts, {
    method,
    headers,
    credentials: "include"
  }));

  const text = await res.text();
  let data = null;
  try{
    data = text ? JSON.parse(text) : null;
  }catch(e){
    const looksHtml = /<\s*!doctype\s+html/i.test(text || "");
    const hint = (res.status === 404 && looksHtml)
      ? "Server functions not found. This app requires Netlify Functions (deploy as a Netlify site with Functions, not a static-only drop)."
      : "Non-JSON response";
    data = { error: hint, raw: text };
  }

  if(!res.ok){
    const err = new Error((data && data.error) ? data.error : ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function fmtDate(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" });
  }catch(e){ return iso; }
}

let __meCache = null;
async function getMe(force=false){
  if(__meCache && !force) return __meCache;
  const me = await apiFetch("/auth-me");
  __meCache = me;
  return me;
}

async function requireMe(){
  try{
    return await getMe(true);
  }catch(err){
    if(err && err.status === 401){
      location.href = "/login.html";
      return null;
    }
    throw err;
  }
}

async function logout(){
  try{ await apiFetch("/auth-logout", { method:"POST", body:"{}" }); }catch(e){}
  // Clear any local-only caches
  try{ localStorage.removeItem("SMV_HANDLE"); }catch(e){}
  location.href = "/";
}

function safe(s){ return (s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c])); }
function getKeyRecordByVersion(me, version){
  if(!me) return null;
  const v = Number(version);
  const keys = Array.isArray(me.keys) ? me.keys : [];
  if(!Number.isFinite(v) || v < 1) return null;
  return keys.find(k => Number(k.version) === v) || null;
}

function getActiveKeyRecord(me){
  if(!me) return null;
  const keys = Array.isArray(me.keys) ? me.keys : [];
  const active = keys.find(k => k && k.is_active) || null;
  if(active) return active;
  if(me && Number.isFinite(Number(me.active_version))){
    return keys.find(k => Number(k.version) === Number(me.active_version)) || null;
  }
  return null;
}

// --- Client-side Search Index (local-only) ---
(function(){
  const KEY = "smv_search_index_v1";
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function save(arr){
    try{ localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 2000))); }catch(e){}
  }
  function upsert(item){
    const arr = load();
    const i = arr.findIndex(x => x.id === item.id);
    if(i >= 0) arr[i] = { ...arr[i], ...item };
    else arr.unshift(item);
    const seen = new Set();
    const out = [];
    for(const x of arr){
      if(!x || !x.id || seen.has(x.id)) continue;
      seen.add(x.id); out.push(x);
    }
    save(out);
  }
  function search(q){
    q = String(q || "").trim().toLowerCase();
    if(!q) return load();
    const arr = load();
    return arr.filter(x => {
      const hay = `${x.subject||""} ${x.snippet||""} ${x.from_email||""} ${x.from_name||""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  function clear(){ try{ localStorage.removeItem(KEY); }catch(e){} }
  window.SMVSearchIndex = { load, upsert, search, clear };
})();