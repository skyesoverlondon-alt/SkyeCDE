import { authLogin, authMe, authSignup, createCheckout, createRequest } from './hub-api.js';

const $ = (id)=>document.getElementById(id);

function toast(el, msg, kind=""){
  el.textContent = msg || "";
  el.className = "status" + (kind ? (" " + kind) : "");
}

let currentUser = null;

const authCard = $("authCard");
const mainCard = $("mainCard");
const authStatus = $("authStatus");
const reqStatus = $("reqStatus");
const quoteBox = $("quoteBox");
const form = $("reqForm");
const payBtn = $("payBtn");

function friendlyCheckoutError(error){
  const raw = String(error?.message || error || '').toLowerCase();
  if(raw.includes('stripe_secret_key') || raw.includes('api key')){
    return 'Checkout is temporarily unavailable because Stripe is not configured on this hub. Your request was saved, but payment could not start.';
  }
  if(raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed')){
    return 'We could not reach Stripe checkout right now. Your request was saved; please try again in a minute.';
  }
  return 'We could not start Stripe checkout right now. Your request was saved; please try again shortly.';
}

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
    const data = await authLogin(email, pass);
    currentUser = data.user || null;
    toast(authStatus, "Signed in ✅", "ok");
    syncAuthUI();
  }catch(e){
    toast(authStatus, "Sign-in failed: " + (e?.message||e), "bad");
  }
});

$("signUpBtn").addEventListener("click", async ()=>{
  const email = $("email").value.trim();
  const pass = $("pass").value;
  if(!email || !pass){ toast(authStatus, "Enter email + password.", "bad"); return; }
  try{
    const data = await authSignup(email, pass, email.split('@')[0], 'client');
    currentUser = data.user || null;
    toast(authStatus, "Account created ✅", "ok");
    syncAuthUI();
  }catch(e){
    toast(authStatus, "Sign-up failed: " + (e?.message||e), "bad");
  }
});

payBtn?.addEventListener("click", async ()=>{
  toast(reqStatus, "", "");
  if(!form.checkValidity()){
    form.reportValidity();
    toast(reqStatus, "Missing required fields.", "bad");
    return;
  }
  if(!currentUser){
    toast(reqStatus, "Sign in first.", "bad");
    return;
  }

  const d = getData();
  const q = calcQuote(d);
  payBtn.disabled = true;

  try{
    toast(reqStatus, "Creating request…", "");
    const request = await createRequest({
      clientUid: currentUser.id,
      clientEmail: currentUser.email || null,
      requestType: d.service === 'daystay' ? 'daystay' : 'one_time',
      payload: d,
      quote: q,
    });

    toast(reqStatus, "Redirecting to payment…", "");
    const checkout = await createCheckout({
      requestId: request.requestId,
      clientUid: currentUser.id,
    });
    if(!checkout.url) throw new Error('missing_checkout_url');
    window.location.href = checkout.url;
  }catch(e){
    console.error(e);
    toast(reqStatus, friendlyCheckoutError(e), "bad");
  }finally{
    payBtn.disabled = false;
  }
});

function syncAuthUI(){
  if(!currentUser){
    authCard.style.display = 'block';
    mainCard.style.display = 'none';
    return;
  }
  authCard.style.display = "none";
  mainCard.style.display = "block";
  renderQuote();
}

authMe().then((data) => {
  currentUser = data.user || null;
  syncAuthUI();
}).catch(() => {
  currentUser = null;
  syncAuthUI();
});
