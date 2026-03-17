import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, collection, query, where, orderBy, getDocs, addDoc, onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const $ = (id)=>document.getElementById(id);
const authCard = $("authCard");
const mainCard = $("mainCard");
const authStatus = $("authStatus");
const msgStatus = $("msgStatus");

function toast(el, msg, kind=""){
  el.textContent = msg || "";
  el.className = "status" + (kind ? (" " + kind) : "");
}

function hasCfg(){
  const c = window.NOBLE_SOUL_FIREBASE_CONFIG || {};
  return c.apiKey && c.projectId && c.appId;
}
if(!hasCfg()){
  toast(authStatus, "Missing Firebase config. Paste it in firebase-config.js and reload.", "bad");
  throw new Error("Missing config");
}

const app = initializeApp(window.NOBLE_SOUL_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

let currentJobId = null;
let unsubUpdates = null;
let unsubMessages = null;

async function loadJobs(uid){
  const list = $("jobList");
  const details = $("jobDetails");
  list.textContent = "Loading…";
  details.textContent = "Select a job.";

  const q = query(collection(db,"jobs"), where("clientUid","==", uid), orderBy("startDate","desc"));
  const snap = await getDocs(q);
  const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));

  list.innerHTML = "";
  if(!rows.length){
    list.textContent = "No jobs found for this account.";
    return;
  }
  rows.forEach((row)=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.style.width = "100%";
    b.style.textAlign = "left";
    b.style.marginBottom = "10px";
    const pet = row.vehicleLabel || "Pet";
    const range = (row.startDate || "") + " → " + (row.endDate || "");
    b.innerHTML = `<b>${pet}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${range}</div>`;
    b.addEventListener("click", ()=>selectJob(row.id, row));
    list.appendChild(b);
  });
}

function renderDetails(row){
  const el = $("jobDetails");
  const obj = {
    jobId: row.id,
    vehicleLabel: row.vehicleLabel,
    vehicleType: row.vehicleType,
    notes: row.notes || "",
    startDate: row.startDate,
    endDate: row.endDate,
    detailerName: row.detailerName || "",
  };
  el.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(obj, null, 2);
  el.appendChild(pre);
}

function selectJob(id, row){
  currentJobId = id;
  renderDetails({id, ...row});
  wireUpdates();
  wireMessages();
}

function wireUpdates(){
  const box = $("updates");
  if(unsubUpdates) unsubUpdates();
  if(!currentJobId){ box.textContent = "Select a job."; return; }
  box.textContent = "Loading updates…";

  const q = query(collection(db, "jobs", currentJobId, "updates"), orderBy("createdAt","desc"));
  unsubUpdates = onSnapshot(q, (snap)=>{
    const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
    box.innerHTML = "";
    if(!rows.length){
      box.textContent = "No updates yet.";
      return;
    }
    rows.forEach(u=>{
      const div = document.createElement("div");
      div.style.padding = "10px";
      div.style.border = "1px solid rgba(255,255,255,0.12)";
      div.style.borderRadius = "14px";
      div.style.background = "rgba(0,0,0,0.18)";
      div.style.marginBottom = "10px";

      const t = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString() : "";
      const note = u.note || "";
      div.innerHTML = `<b>${t}</b><div style="color:rgba(255,255,255,.82); margin-top:6px; white-space:pre-wrap">${escapeHtml(note)}</div>`;

      const photos = Array.isArray(u.photos) ? u.photos : [];
      if(photos.length){
        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(2, minmax(0,1fr))";
        grid.style.gap = "8px";
        grid.style.marginTop = "10px";
        photos.forEach(p=>{
          const a = document.createElement("a");
          a.href = p.url;
          a.target = "_blank";
          a.rel = "noreferrer";
          const img = document.createElement("img");
          img.src = p.url;
          img.alt = "Update photo";
          img.style.width = "100%";
          img.style.borderRadius = "12px";
          img.style.border = "1px solid rgba(255,255,255,0.12)";
          a.appendChild(img);
          grid.appendChild(a);
        });
        div.appendChild(grid);
      }
      box.appendChild(div);
    });
  });
}

function wireMessages(){
  const box = $("messages");
  if(unsubMessages) unsubMessages();
  if(!currentJobId){ box.textContent = "Select a job."; return; }
  box.textContent = "Loading messages…";

  const q = query(collection(db, "jobs", currentJobId, "messages"), orderBy("createdAt","asc"));
  unsubMessages = onSnapshot(q, (snap)=>{
    const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
    box.innerHTML = "";
    if(!rows.length){
      box.textContent = "No messages yet.";
      return;
    }
    rows.forEach(m=>{
      const div = document.createElement("div");
      div.style.padding = "10px";
      div.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
      const t = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : "";
      div.innerHTML = `<b>${escapeHtml(m.fromRole || "user")}</b> <span style="color:rgba(255,255,255,.55); font-size:12px">${t}</span>
        <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(m.text || "")}</div>`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

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

$("sendMsgBtn").addEventListener("click", async ()=>{
  toast(msgStatus, "", "");
  const txt = $("msgText").value.trim();
  if(!txt){ toast(msgStatus, "Type a message.", "bad"); return; }
  if(!currentJobId){ toast(msgStatus, "Select a job first.", "bad"); return; }
  try{
    await addDoc(collection(db, "jobs", currentJobId, "messages"), {
      text: txt,
      fromUid: auth.currentUser.uid,
      fromRole: "client",
      createdAt: new Date()
    });
    $("msgText").value = "";
    toast(msgStatus, "Sent ✅", "ok");
  }catch(e){
    toast(msgStatus, "Send failed: " + (e?.message||e), "bad");
  }
});

$("signOutBtn").addEventListener("click", ()=>signOut(auth));

onAuthStateChanged(auth, async (u)=>{
  if(!u){
    authCard.style.display = "block";
    mainCard.style.display = "none";
    currentJobId = null;
    if(unsubUpdates) unsubUpdates();
    if(unsubMessages) unsubMessages();
    return;
  }
  authCard.style.display = "none";
  mainCard.style.display = "block";
  await loadJobs(u.uid);
});
