import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (id)=>document.getElementById(id);

function toast(el, msg, kind=""){
  el.textContent = msg || "";
  el.className = "status" + (kind ? (" " + kind) : "");
}

function hasCfg(){
  const c = window.NOBLE_SOUL_FIREBASE_CONFIG || {};
  return c.apiKey && c.projectId && c.appId;
}
if(!hasCfg()){
  toast($("authStatus"), "Missing Firebase config. Paste it in firebase-config.js and reload.", "bad");
  throw new Error("Missing config");
}

const app = initializeApp(window.NOBLE_SOUL_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const authCard = $("authCard");
const mainCard = $("mainCard");
const authStatus = $("authStatus");
const reqStatus = $("reqStatus");
const quoteBox = $("quoteBox");
const form = $("reqForm");

const PRICING = {
  boarding: { baseNight: 85 },
  daystay:  { baseDay: 45 },
  inhome:   { baseNight: 110 }
};
const ADDONS = {
  meds: { pills: 8, liquids: 12, injections: 18 },
  transport: { pickup: 20, dropoff: 20, both: 35 },
  peakPct: 0.15
};
const WEEK_DISCOUNT_PCT = 0.10; // 7+ nights

function parseDate(s){ return s ? new Date(s + "T00:00:00") : null; }
function daysBetween(start, end){
  const a = parseDate(start), b = parseDate(end);
  if(!a || !b) return 0;
  const ms = b - a;
  const d = Math.round(ms / (1000*60*60*24));
  return Math.max(0, d);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function getData(){
  const fd = new FormData(form);
  const obj = {};
  for(const [k,v] of fd.entries()) obj[k] = v;
  return obj;
}

function money(n){ return "$" + (Math.round(n*100)/100).toFixed(2); }

function calcQuote(d){
  const service = d.service;
  const petsCount = parseInt(d.petsCount||"1",10) || 1;
  const nights = daysBetween(d.startDate, d.endDate);
  const isPeak = d.peak === "yes";

  let base = 0;
  let units = 0;

  if(service === "boarding"){
    units = nights || 1;
    base = PRICING.boarding.baseNight * units;
  }else if(service === "inhome"){
    units = nights || 1;
    base = PRICING.inhome.baseNight * units;
  }else if(service === "daystay"){
    units = nights || 1; // treat end-start as days; if same-day, user still gets 1
    base = PRICING.daystay.baseDay * units;
  }

  // multi-pet surcharge (simple MVP)
  const multiPetPct = petsCount > 1 ? 0.15*(petsCount-1) : 0;
  let multiPet = base * clamp(multiPetPct, 0, 0.30);

  // meds add-on
  let meds = 0;
  if(d.meds && d.meds.startsWith("Yes")){
    if(d.meds.includes("pills + liquids")) meds = ADDONS.meds.liquids * units;
    else if(d.meds.includes("injections")) meds = ADDONS.meds.injections * units;
    else meds = ADDONS.meds.pills * units;
  }

  // transport
  let transport = 0;
  if(d.transportAddOn && d.transportAddOn !== "none"){
    transport = ADDONS.transport[d.transportAddOn] || 0;
  }

  // week discount
  let discount = 0;
  if((service === "boarding" || service === "inhome") && nights >= 7){
    discount = (base + multiPet) * WEEK_DISCOUNT_PCT;
  }

  let subtotal = (base + multiPet + meds + transport) - discount;
  let peak = isPeak ? subtotal * ADDONS.peakPct : 0;
  subtotal += peak;

  // Taxes not included (depends on your setup)
  return {
    service, units, nights, petsCount,
    lineItems: [
      {label: "Base", amount: base},
      ...(multiPet ? [{label:`Multi-pet surcharge (${petsCount})`, amount: multiPet}] : []),
      ...(meds ? [{label:"Medication handling", amount: meds}] : []),
      ...(transport ? [{label:"Transport add-on", amount: transport}] : []),
      ...(discount ? [{label:"Weekly discount", amount: -discount}] : []),
      ...(peak ? [{label:"Peak pricing", amount: peak}] : [])
    ],
    subtotal
  };
}

function renderQuote(){
  const d = getData();
  const q = calcQuote(d);
  quoteBox.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify({
    service: q.service,
    units: q.units,
    petsCount: q.petsCount,
    estimatedSubtotal: money(q.subtotal),
    breakdown: q.lineItems.map(x=>({label:x.label, amount: money(x.amount)}))
  }, null, 2);
  quoteBox.appendChild(pre);
  return q;
}

form?.addEventListener("input", renderQuote);
form?.addEventListener("change", renderQuote);

function draftKey(){ return "noble_soul_request_draft_v1"; }
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
    const reqDoc = await addDoc(collection(db, "booking_requests"), {
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
        clientUid: auth.currentUser.uid
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
