import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (id)=>document.getElementById(id);

function toast(el, msg, kind=""){
  el.textContent = msg || "";
  el.className = "status" + (kind ? (" " + kind) : "");
}

function hasCfg(){
  const c = window.SOL_DETAILING_FIREBASE_CONFIG || window.NOBLE_SOUL_FIREBASE_CONFIG || {};
  return c.apiKey && c.projectId && c.appId;
}
const CFG = window.SOL_DETAILING_FIREBASE_CONFIG || window.NOBLE_SOUL_FIREBASE_CONFIG || {};
if(!hasCfg()){
  toast($("authStatus"), "Missing Firebase config. Paste it in firebase-config.js and reload.", "bad");
  throw new Error("Missing config");
}

const app = initializeApp(CFG);
const auth = getAuth(app);
const db = getFirestore(app);

const authCard = $("authCard");
const mainCard = $("mainCard");
const authStatus = $("authStatus");
const reqStatus = $("reqStatus");
const quoteBox = $("quoteBox");
const form = $("reqForm");

const BASE = {
  express: { sedan: 55, suv: 70, truck: 80, van: 85, luxury: 110 },
  standard:{ sedan: 140, suv: 165, truck: 185, van: 195, luxury: 260 },
  premium: { sedan: 220, suv: 260, truck: 290, van: 310, luxury: 420 }
};

const SUBS = {
  spark:   { label:"SPARK",   price: 189, includes:"1x/mo Standard (1 vehicle)", visitsPerMonth: 1, level:"standard" },
  glow:    { label:"GLOW",    price: 329, includes:"2x/mo Standard (1 vehicle)", visitsPerMonth: 2, level:"standard" },
  obsidian:{ label:"OBSIDIAN",price: 299, includes:"4x/mo Express (1 vehicle)",  visitsPerMonth: 4, level:"express" }
};

const ADDONS = { engine: 35, headlights: 55, odor: 65, heavySoilPct: 0.20, interiorOffPct: 0.18, extraVehiclePct: 0.85 };

function getData(){
  const fd = new FormData(form);
  const obj = {};
  for(const [k,v] of fd.entries()) obj[k] = v;
  return obj;
}

function money(n){ return "$" + (Math.round(n*100)/100).toFixed(2); }

function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function calcQuote(d){
  const vehicleType = d.vehicleType;
  const serviceLevel = d.serviceLevel;
  const vehicleCount = parseInt(d.vehicleCount||"1",10) || 1;
  const interior = d.interior === "yes";
  const heavy = d.heavySoil === "yes";
  const isSub = d.requestType === "subscription" && d.plan && d.plan !== "none";

  let subtotal = 0;
  const items = [];

  if(isSub){
    const plan = SUBS[d.plan];
    subtotal = plan.price;
    items.push({label:`Subscription: ${plan.label}`, amount: plan.price});
    items.push({label:`Includes`, amount: 0, note: plan.includes});
    // extra vehicles in subscription: discounted add-on
    if(vehicleCount > 1){
      const basePer = BASE[plan.level][vehicleType] || 0;
      const extra = (vehicleCount-1) * basePer * ADDONS.extraVehiclePct;
      subtotal += extra;
      items.push({label:`Extra vehicles (${vehicleCount-1})`, amount: extra});
    }
  }else{
    const basePer = (BASE[serviceLevel]||{})[vehicleType] || 0;
    const base = basePer * vehicleCount;
    subtotal = base;
    items.push({label:`Base (${serviceLevel}, ${vehicleType}) x${vehicleCount}`, amount: base});
  }

  // Adjustments
  if(!interior){
    const off = subtotal * ADDONS.interiorOffPct;
    subtotal -= off;
    items.push({label:"Exterior-only discount", amount: -off});
  }
  if(heavy){
    const extra = subtotal * ADDONS.heavySoilPct;
    subtotal += extra;
    items.push({label:"Heavy soil / pet hair handling", amount: extra});
  }

  if(d.engine === "yes"){ subtotal += ADDONS.engine; items.push({label:"Add-on: Engine bay", amount: ADDONS.engine}); }
  if(d.headlights === "yes"){ subtotal += ADDONS.headlights; items.push({label:"Add-on: Headlight restore", amount: ADDONS.headlights}); }
  if(d.odor === "yes"){ subtotal += ADDONS.odor; items.push({label:"Add-on: Odor treatment", amount: ADDONS.odor}); }

  return { subtotal, items, isSubscription: isSub, plan: isSub ? d.plan : null };
}

function renderQuote(){
  const d = getData();
  const q = calcQuote(d);
  quoteBox.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify({
    requestType: d.requestType,
    plan: d.plan,
    estimatedSubtotal: money(q.subtotal),
    breakdown: q.items.map(x=>({label:x.label, amount: money(x.amount)}))
  }, null, 2);
  quoteBox.appendChild(pre);
  return q;
}

form?.addEventListener("input", renderQuote);
form?.addEventListener("change", renderQuote);

function draftKey(){ return "sol_detail_request_draft_v1"; }
$("saveReqBtn")?.addEventListener("click", ()=>{
  localStorage.setItem(draftKey(), JSON.stringify({data:getData(), savedAt:new Date().toISOString()}));
  toast(reqStatus, "Draft saved on this device.", "ok");
});
$("loadReqBtn")?.addEventListener("click", ()=>{
  const raw = localStorage.getItem(draftKey());
  if(!raw){ toast(reqStatus, "No draft found.", "bad"); return; }
  const parsed = JSON.parse(raw);
  const d = parsed.data || {};
  Object.entries(d).forEach(([k,v])=>{
    const el = form.querySelector(`[name="${CSS.escape(k)}"]`);
    if(el) el.value = v;
  });
  renderQuote();
  toast(reqStatus, "Draft loaded.", "ok");
});

$("signInBtn").addEventListener("click", async ()=>{
  const email = $("email").value.trim();
  const pass = $("pass").value;
  if(!email || !pass){ toast(authStatus, "Enter email + password.", "bad"); return; }
  try{
    await signInWithEmailAndPassword(auth, email, pass);
    toast(authStatus, "Signed in ✅", "ok");
  }catch(e){
    toast(authStatus, "Sign-in failed: " + (e?.message||e), "bad");
  }
});

$("signUpBtn").addEventListener("click", async ()=>{
  const email = $("email").value.trim();
  const pass = $("pass").value;
  if(!email || !pass){ toast(authStatus, "Enter email + password.", "bad"); return; }
  try{
    await createUserWithEmailAndPassword(auth, email, pass);
    toast(authStatus, "Account created ✅", "ok");
  }catch(e){
    toast(authStatus, "Sign-up failed: " + (e?.message||e), "bad");
  }
});

$("payBtn")?.addEventListener("click", async ()=>{
  toast(reqStatus, "", "");
  if(!form.checkValidity()){
    form.reportValidity();
    toast(reqStatus, "Missing required fields.", "bad");
    return;
  }
  if(!auth.currentUser){
    toast(reqStatus, "Sign in first.", "bad");
    return;
  }

  const d = getData();
  const q = calcQuote(d);

  try{
    toast(reqStatus, "Creating request…", "");
    const reqDoc = await addDoc(collection(db, "service_requests"), {
      ...d,
      clientUid: auth.currentUser.uid,
      clientEmail: auth.currentUser.email || null,
      quote: q,
      status: "created_unpaid",
      createdAt: serverTimestamp()
    });

    toast(reqStatus, "Redirecting to payment…", "");
    const resp = await fetch("/.netlify/functions/create-checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: reqDoc.id,
        clientUid: auth.currentUser.uid,
        requestType: d.requestType,
        plan: d.plan,
        quoteSubtotal: q.subtotal
      })
    });

    const j = await resp.json();
    if(!j.ok) throw new Error(j.error || "checkout error");
    window.location.href = j.url;
  }catch(e){
    console.error(e);
    toast(reqStatus, "Failed: " + (e?.message||e), "bad");
  }
});

onAuthStateChanged(auth, (u)=>{
  if(!u){
    authCard.style.display = "block";
    mainCard.style.display = "none";
    return;
  }
  authCard.style.display = "none";
  mainCard.style.display = "block";
  renderQuote();
});
