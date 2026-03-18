import { authLogin, authLogout, authMe, authSignup, listBookingMessages, listBookingUpdates, listBookings, postBookingMessage } from './hub-api.js';

const $ = (id)=>document.getElementById(id);
const authCard = $("authCard");
const mainCard = $("mainCard");
const authStatus = $("authStatus");
const msgStatus = $("msgStatus");

function toast(el, msg, kind=""){
  el.textContent = msg || "";
  el.className = "status" + (kind ? (" " + kind) : "");
}

let currentUser = null;

let currentBookingId = null;
let unsubUpdates = null;
let unsubMessages = null;

async function loadBookings(){
  const list = $("bookingList");
  const details = $("bookingDetails");
  list.textContent = "Loading…";
  details.textContent = "Select a booking.";

  const data = await listBookings();
  const rows = data.bookings || [];

  list.innerHTML = "";
  if(!rows.length){
    list.textContent = "No bookings found for this account.";
    return;
  }
  rows.forEach((row)=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.style.width = "100%";
    b.style.textAlign = "left";
    b.style.marginBottom = "10px";
    const pet = row.petName || "Pet";
    const range = (row.startDate || "") + " → " + (row.endDate || "");
    b.innerHTML = `<b>${pet}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${range}</div>`;
    b.addEventListener("click", ()=>selectBooking(row.id, row));
    list.appendChild(b);
  });
}

function renderDetails(row){
  const el = $("bookingDetails");
  const obj = {
    bookingId: row.id,
    petName: row.petName,
    petType: row.petType,
    notes: row.notes || "",
    startDate: row.startDate,
    endDate: row.endDate,
    caregiverName: row.caregiverName || "",
  };
  el.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(obj, null, 2);
  el.appendChild(pre);
}

function selectBooking(id, row){
  currentBookingId = id;
  renderDetails({id, ...row});
  wireUpdates().catch((error) => toast(msgStatus, 'Update load failed: ' + (error.message || error), 'bad'));
  wireMessages().catch((error) => toast(msgStatus, 'Message load failed: ' + (error.message || error), 'bad'));
}

async function wireUpdates(){
  const box = $("updates");
  if(!currentBookingId){ box.textContent = "Select a booking."; return; }
  box.textContent = "Loading updates…";
  const data = await listBookingUpdates(currentBookingId);
  const rows = data.updates || [];
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

    const t = u.created_at ? new Date(u.created_at).toLocaleString() : "";
    const note = u.note || "";
    div.innerHTML = `<b>${t}</b><div style="color:rgba(255,255,255,.82); margin-top:6px; white-space:pre-wrap">${escapeHtml(note)}</div>`;

    const photos = Array.isArray(u.photos) ? u.photos : [];
    if(photos.length){
      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(2, minmax(0,1fr))";
      grid.style.gap = "8px";
      grid.style.marginTop = "10px";
      photos.forEach((p)=>{
        const link = document.createElement("a");
        link.href = p.dataUrl || '#';
        link.target = "_blank";
        link.rel = "noreferrer";
        const img = document.createElement("img");
        img.src = p.dataUrl || '#';
        img.alt = "Update photo";
        img.style.width = "100%";
        img.style.borderRadius = "12px";
        img.style.border = "1px solid rgba(255,255,255,0.12)";
        link.appendChild(img);
        grid.appendChild(link);
      });
      div.appendChild(grid);
    }
    box.appendChild(div);
  });
}

async function wireMessages(){
  const box = $("messages");
  if(!currentBookingId){ box.textContent = "Select a booking."; return; }
  box.textContent = "Loading messages…";
  const data = await listBookingMessages(currentBookingId);
  const rows = data.messages || [];
  box.innerHTML = "";
  if(!rows.length){
    box.textContent = "No messages yet.";
    return;
  }
  rows.forEach(m=>{
    const div = document.createElement("div");
    div.style.padding = "10px";
    div.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
    const t = m.created_at ? new Date(m.created_at).toLocaleString() : "";
    div.innerHTML = `<b>${escapeHtml(m.from_role || "user")}</b> <span style="color:rgba(255,255,255,.55); font-size:12px">${t}</span>
      <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(m.text || "")}</div>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
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

$("sendMsgBtn").addEventListener("click", async ()=>{
  toast(msgStatus, "", "");
  const txt = $("msgText").value.trim();
  if(!txt){ toast(msgStatus, "Type a message.", "bad"); return; }
  if(!currentBookingId){ toast(msgStatus, "Select a booking first.", "bad"); return; }
  try{
    await postBookingMessage(currentBookingId, txt);
    $("msgText").value = "";
    toast(msgStatus, "Sent ✅", "ok");
    await wireMessages();
  }catch(e){
    toast(msgStatus, "Send failed: " + (e?.message||e), "bad");
  }
});

$("signOutBtn").addEventListener("click", async ()=>{
  await authLogout().catch(() => {});
  currentUser = null;
  syncAuthUI();
});

async function syncAuthUI(){
  if(!currentUser){
    authCard.style.display = "block";
    mainCard.style.display = "none";
    currentBookingId = null;
    return;
  }
  authCard.style.display = "none";
  mainCard.style.display = "block";
  await loadBookings();
}

authMe().then((data) => {
  currentUser = data.user || null;
  return syncAuthUI();
}).catch(() => {
  currentUser = null;
  return syncAuthUI();
});
