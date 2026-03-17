import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-storage.js";

const $ = (id)=>document.getElementById(id);
function toast(el,msg,kind=""){ el.textContent=msg||""; el.className="status"+(kind?(" "+kind):""); }
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function hasCfg(){ const c=window.SKYHUBS_FIREBASE_CONFIG||{}; return c.apiKey&&c.projectId&&c.appId; }
if(!hasCfg()){ toast($("authStatus"), "Missing Firebase config. Paste it in firebase-config.js and reload.", "bad"); throw new Error("Missing config"); }

const app=initializeApp(window.SKYHUBS_FIREBASE_CONFIG);
const auth=getAuth(app);
const db=getFirestore(app);
const storage=getStorage(app);

let currentStayId=null;
let unsubUpdates=null, unsubMessages=null;

async function isCohost(uid){
  const snap=await getDoc(doc(db,"users",uid));
  return snap.exists() && snap.data()?.role === "cohost";
}

async function loadStays(uid){
  const list=$("stayList");
  const details=$("stayDetails");
  list.textContent="Loading…";
  details.textContent="Select a stay.";

  const q=query(collection(db,"stays"), where("cohostUid","==", uid), orderBy("turnoverDate","desc"));
  const snap=await getDocs(q);
  const rows=snap.docs.map(d=>({id:d.id, ...d.data()}));

  list.innerHTML="";
  if(!rows.length){ list.textContent="No stays assigned yet."; return; }
  rows.forEach(row=>{
    const btn=document.createElement("button");
    btn.type="button"; btn.className="btn"; btn.style.width="100%"; btn.style.textAlign="left"; btn.style.marginBottom="10px";
    const t=row.turnoverDate || row.startDate || "";
    btn.innerHTML=`<b>${escapeHtml(row.listingName||"Listing")}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${escapeHtml(t)} • ${escapeHtml(row.serviceType||"")}</div>`;
    btn.addEventListener("click", ()=>selectStay(row.id,row));
    list.appendChild(btn);
  });
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
    hostName: stay.hostName||"",
    hostEmail: stay.hostEmail||"",
    guestComms: stay.guestComms||"no",
    notes: stay.notes||""
  };
  el.innerHTML="";
  const pre=document.createElement("pre"); pre.textContent=JSON.stringify(obj,null,2);
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

async function uploadPhotos(stayId, files){
  const out=[];
  for(const file of files){
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,"_").slice(0,120);
    const path=`stays/${stayId}/updates/${Date.now()}_${safe}`;
    const r=ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
    const url=await getDownloadURL(r);
    out.push({ name:file.name, url, path, size:file.size, type:file.type||null });
  }
  return out;
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
  try{ await createUserWithEmailAndPassword(auth,email,pass); toast($("authStatus"), "Account created ✅ (ops must approve role: cohost)", "ok"); }
  catch(e){ toast($("authStatus"), "Sign-up failed: "+(e?.message||e), "bad"); }
});

$("postUpdateBtn").addEventListener("click", async ()=>{
  toast($("updateStatus"), "", "");
  const note=$("updateNote").value.trim();
  if(!currentStayId){ toast($("updateStatus"), "Select a stay first.", "bad"); return; }
  if(!note){ toast($("updateStatus"), "Write an update note.", "bad"); return; }
  const files=Array.from($("updatePhotos").files||[]);
  try{
    toast($("updateStatus"), "Uploading…", "");
    const photos = files.length ? await uploadPhotos(currentStayId, files) : [];
    await addDoc(collection(db,"stays",currentStayId,"updates"), {
      note,
      photos,
      createdAt: serverTimestamp(),
      createdByUid: auth.currentUser.uid
    });
    $("updateNote").value=""; $("updatePhotos").value="";
    toast($("updateStatus"), "Posted ✅", "ok");
  }catch(e){
    console.error(e);
    toast($("updateStatus"), "Post failed: "+(e?.message||e), "bad");
  }
});

$("sendMsgBtn").addEventListener("click", async ()=>{
  toast($("msgStatus"), "", "");
  const txt=$("msgText").value.trim();
  if(!txt){ toast($("msgStatus"), "Type a message.", "bad"); return; }
  if(!currentStayId){ toast($("msgStatus"), "Select a stay first.", "bad"); return; }
  try{
    await addDoc(collection(db,"stays",currentStayId,"messages"), {
      text: txt,
      fromUid: auth.currentUser.uid,
      fromRole: "cohost",
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
    $("authCard").style.display="block"; $("mainCard").style.display="none";
    currentStayId=null;
    if(unsubUpdates) unsubUpdates();
    if(unsubMessages) unsubMessages();
    return;
  }
  try{
    const ok=await isCohost(u.uid);
    if(!ok){
      toast($("authStatus"), "This account is not approved as a co-host yet. Contact ops.", "bad");
      await signOut(auth); return;
    }
  }catch(e){
    toast($("authStatus"), "Role check failed. Check Firestore rules for /users.", "bad");
    await signOut(auth); return;
  }

  $("authCard").style.display="none"; $("mainCard").style.display="block";
  await loadStays(u.uid);
});
