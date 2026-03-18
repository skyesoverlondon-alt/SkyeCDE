import {
  authLogin,
  authLogout,
  authMe,
  filesToPayload,
  listStayMessages,
  listStays,
  listStayUpdates,
  postStayMessage,
  postStayUpdate,
} from './hub-api.js';

const $ = (id)=>document.getElementById(id);
function toast(el,msg,kind=""){ el.textContent=msg||""; el.className="status"+(kind?(" "+kind):""); }
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

let currentStayId=null;

let currentUser = null;

async function loadStays(){
  const list=$("stayList");
  const details=$("stayDetails");
  list.textContent="Loading…";
  details.textContent="Select a stay.";
  const data = await listStays();
  const rows = data.stays || [];

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
  loadUpdates();
  loadMessages();
}

async function loadUpdates(){
  const box=$("updates");
  if(!currentStayId){ box.textContent="Select a stay."; return; }
  box.textContent="Loading updates…";
  const data = await listStayUpdates(currentStayId);
  const rows = data.updates || [];
  box.innerHTML="";
  if(!rows.length){ box.textContent="No updates yet."; return; }
  rows.forEach(u=>{
    const div=document.createElement("div");
    div.style.padding="10px";
    div.style.border="1px solid rgba(255,255,255,0.12)";
    div.style.borderRadius="14px";
    div.style.background="rgba(0,0,0,0.18)";
    div.style.marginBottom="10px";
    const t=u.created_at ? new Date(u.created_at).toLocaleString() : "";
    div.innerHTML=`<b>${t}</b><div style="color:rgba(255,255,255,.82); margin-top:6px; white-space:pre-wrap">${escapeHtml(u.note||"")}</div>`;
    const photos=Array.isArray(u.photos)?u.photos:[];
    if(photos.length){
      const grid=document.createElement("div");
      grid.style.display="grid";
      grid.style.gridTemplateColumns="repeat(2, minmax(0,1fr))";
      grid.style.gap="8px"; grid.style.marginTop="10px";
      photos.forEach(p=>{
        if(!p.dataUrl) return;
        const a=document.createElement("a");
        a.href=p.dataUrl; a.target="_blank"; a.rel="noreferrer";
        const img=document.createElement("img");
        img.src=p.dataUrl; img.alt="Proof photo";
        img.style.width="100%"; img.style.borderRadius="12px"; img.style.border="1px solid rgba(255,255,255,0.12)";
        a.appendChild(img); grid.appendChild(a);
      });
      div.appendChild(grid);
    }
    box.appendChild(div);
  });
}

async function loadMessages(){
  const box=$("messages");
  if(!currentStayId){ box.textContent="Select a stay."; return; }
  box.textContent="Loading messages…";
  const data = await listStayMessages(currentStayId);
  const rows = data.messages || [];
  box.innerHTML="";
  if(!rows.length){ box.textContent="No messages yet."; return; }
  rows.forEach(m=>{
    const div=document.createElement("div");
    div.style.padding="10px";
    div.style.borderBottom="1px solid rgba(255,255,255,0.10)";
    const t=m.created_at ? new Date(m.created_at).toLocaleString() : "";
    div.innerHTML=`<b>${escapeHtml(m.from_role||"user")}</b> <span style="color:rgba(255,255,255,.55); font-size:12px">${t}</span>
      <div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(m.text||"")}</div>`;
    box.appendChild(div);
  });
  box.scrollTop=box.scrollHeight;
}

$("signInBtn").addEventListener("click", async ()=>{
  const email=$("email").value.trim(), pass=$("pass").value;
  if(!email||!pass){ toast($("authStatus"), "Enter email + password.", "bad"); return; }
  try{
    const data = await authLogin(email, pass);
    if(data.user?.role !== 'cohost') throw new Error('cohost_access_required');
    toast($("authStatus"), "Signed in ✅", "ok");
    await bootstrap();
  }
  catch(e){ toast($("authStatus"), "Sign-in failed: "+(e?.message||e), "bad"); }
});

$("postUpdateBtn").addEventListener("click", async ()=>{
  toast($("updateStatus"), "", "");
  const note=$("updateNote").value.trim();
  if(!currentStayId){ toast($("updateStatus"), "Select a stay first.", "bad"); return; }
  if(!note){ toast($("updateStatus"), "Write an update note.", "bad"); return; }
  const files=Array.from($("updatePhotos").files||[]);
  try{
    toast($("updateStatus"), "Uploading…", "");
    const photos = files.length ? await filesToPayload(files) : [];
    await postStayUpdate(currentStayId, note, photos);
    $("updateNote").value=""; $("updatePhotos").value="";
    toast($("updateStatus"), "Posted ✅", "ok");
    await loadUpdates();
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
    await postStayMessage(currentStayId, txt);
    $("msgText").value="";
    toast($("msgStatus"), "Sent ✅", "ok");
    await loadMessages();
  }catch(e){
    toast($("msgStatus"), "Send failed: "+(e?.message||e), "bad");
  }
});

$("signOutBtn").addEventListener("click", async ()=>{
  await authLogout();
  currentUser = null;
  currentStayId = null;
  $("authCard").style.display="block";
  $("mainCard").style.display="none";
});

async function bootstrap(){
  try{
    const data = await authMe();
    currentUser = data.user;
    if(currentUser?.role !== 'cohost') throw new Error('cohost_access_required');
    $("authCard").style.display="none"; $("mainCard").style.display="block";
    await loadStays();
  }catch(_){
    $("authCard").style.display="block"; $("mainCard").style.display="none";
  }
}

bootstrap();
