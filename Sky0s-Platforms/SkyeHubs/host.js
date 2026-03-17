import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (id)=>document.getElementById(id);

function toast(el,msg,kind=""){ el.textContent=msg||""; el.className="status"+(kind?(" "+kind):""); }
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function hasCfg(){ const c = window.SKYHUBS_FIREBASE_CONFIG || {}; return c.apiKey && c.projectId && c.appId; }
if(!hasCfg()){ toast($("authStatus"), "Missing Firebase config. Paste it in firebase-config.js and reload.", "bad"); throw new Error("Missing config"); }

const app = initializeApp(window.SKYHUBS_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

let currentStayId=null;
let unsubUpdates=null, unsubMessages=null;

async function loadStays(uid){
  const list = $("stayList");
  const cal = $("calendar");
  const details = $("stayDetails");
  list.textContent="Loading…"; cal.textContent=""; details.textContent="Select a stay.";
  const q = query(collection(db,"stays"), where("hostUid","==", uid), orderBy("turnoverDate","desc"));
  const snap = await getDocs(q);
  const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));

  list.innerHTML="";
  if(!rows.length){ list.textContent="No stays found."; cal.textContent=""; return; }

  // List
  rows.forEach(row=>{
    const btn=document.createElement("button");
    btn.type="button"; btn.className="btn"; btn.style.width="100%"; btn.style.textAlign="left"; btn.style.marginBottom="10px";
    const t=row.turnoverDate || row.startDate || "";
    btn.innerHTML = `<b>${escapeHtml(row.listingName||"Listing")}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${escapeHtml(t)} • ${escapeHtml(row.serviceType||"")}</div>`;
    btn.addEventListener("click", ()=>selectStay(row.id, row));
    list.appendChild(btn);
  });

  // Calendar (simple month grid for current month)
  renderCalendar(rows);
}

function renderCalendar(rows){
  const box = $("calendar");
  box.innerHTML="";
  const now=new Date();
  const y=now.getFullYear(), m=now.getMonth();
  const first=new Date(y,m,1);
  const startDow=first.getDay();
  const daysIn=new Date(y,m+1,0).getDate();
  const title=document.createElement("div");
  title.style.display="flex"; title.style.justifyContent="space-between"; title.style.alignItems="center";
  title.innerHTML = `<b>${now.toLocaleString(undefined,{month:"long"})} ${y}</b><span class="pill">Calendar</span>`;
  box.appendChild(title);

  const grid=document.createElement("div");
  grid.style.display="grid";
  grid.style.gridTemplateColumns="repeat(7, minmax(0, 1fr))";
  grid.style.gap="6px";
  grid.style.marginTop="10px";

  const dow=["S","M","T","W","T","F","S"];
  dow.forEach(d=>{
    const h=document.createElement("div");
    h.style.textAlign="center";
    h.style.color="rgba(255,255,255,.55)";
    h.style.fontSize="12px";
    h.textContent=d;
    grid.appendChild(h);
  });

  // blanks
  for(let i=0;i<startDow;i++){
    const c=document.createElement("div"); c.style.height="44px";
    grid.appendChild(c);
  }

  const byDate = new Map();
  rows.forEach(r=>{
    const d = r.turnoverDate || r.startDate;
    if(!d) return;
    byDate.set(d, (byDate.get(d)||[]).concat([r]));
  });

  for(let day=1; day<=daysIn; day++){
    const dstr = new Date(y,m,day).toISOString().slice(0,10);
    const cell=document.createElement("div");
    cell.style.height="44px";
    cell.style.border="1px solid rgba(255,255,255,.10)";
    cell.style.borderRadius="12px";
    cell.style.padding="6px";
    cell.style.background="rgba(0,0,0,0.16)";
    cell.style.cursor="default";
    cell.innerHTML = `<div style="font-size:12px; color:rgba(255,255,255,.75)">${day}</div>`;
    const items = byDate.get(dstr) || [];
    if(items.length){
      cell.style.borderColor="rgba(250,204,21,0.45)";
      cell.style.cursor="pointer";
      const dot=document.createElement("div");
      dot.style.marginTop="4px";
      dot.innerHTML = `<span class="pill" style="font-size:11px;">${items.length} turn</span>`;
      cell.appendChild(dot);
      cell.addEventListener("click", ()=>{
        // pick first stay for now
        selectStay(items[0].id, items[0]);
      });
    }
    grid.appendChild(cell);
  }
  box.appendChild(grid);
}

function renderDetails(stay){
  const el=$("stayDetails");
  const obj={
    stayId: stay.id,
    listingName: stay.listingName,
    serviceType: stay.serviceType,
    turnoverDate: stay.turnoverDate,
    startDate: stay.startDate,
    endDate: stay.endDate,
    cohostName: stay.cohostName || "",
    guestComms: stay.guestComms || "no",
    notes: stay.notes || ""
  };
  el.innerHTML="";
  const pre=document.createElement("pre");
  pre.textContent=JSON.stringify(obj,null,2);
  el.appendChild(pre);
}

function selectStay(id, stay){
  currentStayId=id;
  renderDetails({id, ...stay});
  wireUpdates();
  wireMessages();
}

function wireUpdates(){
  const box=$("updates");
  if(unsubUpdates) unsubUpdates();
  if(!currentStayId){ box.textContent="Select a stay."; return; }
  box.textContent="Loading updates…";
  const q=query(collection(db,"stays",currentStayId,"updates"), orderBy("createdAt","desc"));
  unsubUpdates=onSnapshot(q,(snap)=>{
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    box.innerHTML="";
    if(!rows.length){ box.textContent="No updates yet."; return; }
    rows.forEach(u=>{
      const div=document.createElement("div");
      div.style.padding="10px";
      div.style.border="1px solid rgba(255,255,255,0.12)";
      div.style.borderRadius="14px";
      div.style.background="rgba(0,0,0,0.18)";
      div.style.marginBottom="10px";
      const t=u.createdAt?.toDate?u.createdAt.toDate().toLocaleString():"";
      div.innerHTML=`<b>${t}</b><div style="color:rgba(255,255,255,.82); margin-top:6px; white-space:pre-wrap">${escapeHtml(u.note||"")}</div>`;
      const photos=Array.isArray(u.photos)?u.photos:[];
      if(photos.length){
        const grid=document.createElement("div");
        grid.style.display="grid";
        grid.style.gridTemplateColumns="repeat(2, minmax(0,1fr))";
        grid.style.gap="8px"; grid.style.marginTop="10px";
        photos.forEach(p=>{
          const a=document.createElement("a");
          a.href=p.url; a.target="_blank"; a.rel="noreferrer";
          const img=document.createElement("img");
          img.src=p.url; img.alt="Proof photo";
          img.style.width="100%"; img.style.borderRadius="12px"; img.style.border="1px solid rgba(255,255,255,0.12)";
          a.appendChild(img); grid.appendChild(a);
        });
        div.appendChild(grid);
      }
      box.appendChild(div);
    });
  });
}

function wireMessages(){
  const box=$("messages");
  if(unsubMessages) unsubMessages();
  if(!currentStayId){ box.textContent="Select a stay."; return; }
  box.textContent="Loading messages…";
  const q=query(collection(db,"stays",currentStayId,"messages"), orderBy("createdAt","asc"));
  unsubMessages=onSnapshot(q,(snap)=>{
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    box.innerHTML="";
    if(!rows.length){ box.textContent="No messages yet."; return; }
    rows.forEach(m=>{
      const div=document.createElement("div");
      div.style.padding="10px";
      div.style.borderBottom="1px solid rgba(255,255,255,0.10)";
      const t=m.createdAt?.toDate?m.createdAt.toDate().toLocaleString():"";
      div.innerHTML=`<b>${escapeHtml(m.fromRole||"user")}</b> <span style="color:rgba(255,255,255,.55); font-size:12px">${t}</span>
        <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(m.text||"")}</div>`;
      box.appendChild(div);
    });
    box.scrollTop=box.scrollHeight;
  });
}

$("signInBtn").addEventListener("click", async ()=>{
  const email=$("email").value.trim(), pass=$("pass").value;
  if(!email||!pass){ toast($("authStatus"), "Enter email + password.", "bad"); return; }
  try{ await signInWithEmailAndPassword(auth,email,pass); toast($("authStatus"), "Signed in ✅", "ok"); }
  catch(e){ toast($("authStatus"), "Sign-in failed: "+(e?.message||e), "bad"); }
});
$("signUpBtn").addEventListener("click", async ()=>{
  const email=$("email").value.trim(), pass=$("pass").value;
  if(!email||!pass){ toast($("authStatus"), "Enter email + password.", "bad"); return; }
  try{ await createUserWithEmailAndPassword(auth,email,pass); toast($("authStatus"), "Account created ✅", "ok"); }
  catch(e){ toast($("authStatus"), "Sign-up failed: "+(e?.message||e), "bad"); }
});
$("sendMsgBtn").addEventListener("click", async ()=>{
  toast($("msgStatus"),"", "");
  const txt=$("msgText").value.trim();
  if(!txt){ toast($("msgStatus"), "Type a message.", "bad"); return; }
  if(!currentStayId){ toast($("msgStatus"), "Select a stay first.", "bad"); return; }
  try{
    await addDoc(collection(db,"stays",currentStayId,"messages"), {
      text: txt,
      fromUid: auth.currentUser.uid,
      fromRole: "host",
      createdAt: serverTimestamp()
    });
    $("msgText").value="";
    toast($("msgStatus"), "Sent ✅", "ok");
  }catch(e){
    toast($("msgStatus"), "Send failed: "+(e?.message||e), "bad");
  }
});

$("signOutBtn").addEventListener("click", ()=>signOut(auth));

onAuthStateChanged(auth, async (u)=>{
  if(!u){
    $("authCard").style.display="block";
    $("mainCard").style.display="none";
    currentStayId=null;
    if(unsubUpdates) unsubUpdates();
    if(unsubMessages) unsubMessages();
    return;
  }
  $("authCard").style.display="none";
  $("mainCard").style.display="block";
  await loadStays(u.uid);
});
