import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (id)=>document.getElementById(id);
function toast(el,msg,kind=""){ el.textContent=msg||""; el.className="status"+(kind?(" "+kind):""); }

function hasCfg(){ const c = window.SKYHUBS_FIREBASE_CONFIG || {}; return c.apiKey && c.projectId && c.appId; }
if(!hasCfg()){ toast($("authStatus"), "Missing Firebase config. Paste it in firebase-config.js.", "bad"); throw new Error("Missing config"); }

const app = initializeApp(window.SKYHUBS_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const authCard=$("authCard"), mainCard=$("mainCard");
const authStatus=$("authStatus"), reqStatus=$("reqStatus"), quoteBox=$("quoteBox"), form=$("reqForm");

// Pricing (MVP): base by beds/baths + add-ons + urgency. Subs are flat buckets.
const BASE = {
  Studio: 95, "1": 115, "2": 145, "3": 175, "4+": 215
};
const BATH_MULT = { "1": 1.0, "1.5": 1.08, "2": 1.18, "2.5": 1.30, "3+": 1.45 };
const ADD = { laundry: 25, restock: 20, deepClean: 65, urgentPct: 0.25, guestComms: 18 };

const SUBS = {
  lite: { label:"LITE", price: 699, includes:"Up to 4 turnovers/mo" },
  plus: { label:"PLUS", price: 1199, includes:"Up to 8 turnovers/mo" },
  pro:  { label:"PRO",  price: 2099, includes:"Up to 16 turnovers/mo" }
};

function getData(){ const fd=new FormData(form); const o={}; for(const [k,v] of fd.entries()) o[k]=v; return o; }
function money(n){ return "$"+(Math.round(n*100)/100).toFixed(2); }

function calcQuote(d){
  const isSub = d.requestType === "subscription" && d.plan && d.plan !== "none";
  const items=[];
  let subtotal=0;

  if(isSub){
    const plan = SUBS[d.plan];
    subtotal = plan.price;
    items.push({label:`Subscription: ${plan.label}`, amount: plan.price});
    items.push({label:`Includes`, amount: 0, note: plan.includes});
  }else{
    const base = BASE[d.bedrooms] || 120;
    const mult = BATH_MULT[d.bathrooms] || 1.0;
    subtotal = base * mult;
    items.push({label:`Base turnover (${d.bedrooms} bed / ${d.bathrooms} bath)`, amount: subtotal});
  }

  if(d.guestComms === "yes"){ subtotal += ADD.guestComms; items.push({label:"Guest comms handling", amount: ADD.guestComms}); }
  if(d.laundry === "yes"){ subtotal += ADD.laundry; items.push({label:"Laundry/linens", amount: ADD.laundry}); }
  if(d.restock === "yes"){ subtotal += ADD.restock; items.push({label:"Supplies restock run", amount: ADD.restock}); }
  if(d.deepClean === "yes"){ subtotal += ADD.deepClean; items.push({label:"Deep clean add-on", amount: ADD.deepClean}); }
  if(d.urgent === "yes"){
    const up = subtotal * ADD.urgentPct;
    subtotal += up;
    items.push({label:"Urgent scheduling", amount: up});
  }

  return { subtotal, items, isSubscription: isSub, plan: isSub ? d.plan : null };
}

function renderQuote(){
  const d=getData();
  const q=calcQuote(d);
  quoteBox.innerHTML="";
  const pre=document.createElement("pre");
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

function draftKey(){ return "skyehubs_request_draft_v1"; }
$("saveReqBtn")?.addEventListener("click", ()=>{ localStorage.setItem(draftKey(), JSON.stringify({data:getData(), savedAt:new Date().toISOString()})); toast(reqStatus,"Draft saved.","ok"); });
$("loadReqBtn")?.addEventListener("click", ()=>{
  const raw=localStorage.getItem(draftKey());
  if(!raw){ toast(reqStatus,"No draft found.","bad"); return; }
  const parsed=JSON.parse(raw); const d=parsed.data||{};
  Object.entries(d).forEach(([k,v])=>{ const el=form.querySelector(`[name="${CSS.escape(k)}"]`); if(el) el.value=v; });
  renderQuote(); toast(reqStatus,"Draft loaded.","ok");
});

$("signInBtn").addEventListener("click", async ()=>{
  const email=$("email").value.trim(), pass=$("pass").value;
  if(!email||!pass){ toast(authStatus,"Enter email + password.","bad"); return; }
  try{ await signInWithEmailAndPassword(auth,email,pass); toast(authStatus,"Signed in ✅","ok"); }
  catch(e){ toast(authStatus,"Sign-in failed: "+(e?.message||e),"bad"); }
});
$("signUpBtn").addEventListener("click", async ()=>{
  const email=$("email").value.trim(), pass=$("pass").value;
  if(!email||!pass){ toast(authStatus,"Enter email + password.","bad"); return; }
  try{ await createUserWithEmailAndPassword(auth,email,pass); toast(authStatus,"Account created ✅","ok"); }
  catch(e){ toast(authStatus,"Sign-up failed: "+(e?.message||e),"bad"); }
});

$("payBtn")?.addEventListener("click", async ()=>{
  toast(reqStatus,"","");
  if(!form.checkValidity()){ form.reportValidity(); toast(reqStatus,"Missing required fields.","bad"); return; }
  if(!auth.currentUser){ toast(reqStatus,"Sign in first.","bad"); return; }

  const d=getData(); const q=calcQuote(d);
  try{
    toast(reqStatus,"Creating request…","");
    const reqDoc = await addDoc(collection(db,"host_requests"), {
      ...d,
      hostUid: auth.currentUser.uid,
      hostEmail: auth.currentUser.email || null,
      quote: q,
      status: "created_unpaid",
      createdAt: serverTimestamp()
    });

    toast(reqStatus,"Redirecting to payment…","");
    const resp = await fetch("/.netlify/functions/create-checkout", {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ requestId: reqDoc.id, hostUid: auth.currentUser.uid, requestType: d.requestType, quoteSubtotal: q.subtotal })
    });
    const j = await resp.json();
    if(!j.ok) throw new Error(j.error || "checkout error");
    window.location.href = j.url;
  }catch(e){
    console.error(e);
    toast(reqStatus,"Failed: "+(e?.message||e),"bad");
  }
});

onAuthStateChanged(auth, (u)=>{
  if(!u){ authCard.style.display="block"; mainCard.style.display="none"; return; }
  authCard.style.display="none"; mainCard.style.display="block"; renderQuote();
});
