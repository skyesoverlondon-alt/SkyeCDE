import { filesToPayload, submitIntake } from './hub-api.js';

const $ = (id) => document.getElementById(id);
const form = $("intakeForm");
const connectGate = $('connectGate');
const connectStatus = $('connectStatus');
const retryConnectBtn = $('retryConnectBtn');

const steps = Array.from(document.querySelectorAll(".step"));
const stepperItems = Array.from(document.querySelectorAll(".stepper__item"));
const backBtn = $("backBtn");
const nextBtn = $("nextBtn");
const resetBtn = $("resetBtn");
const saveDraftBtn = $("saveDraftBtn");
const resumeDraftBtn = $("resumeDraftBtn");
const submitStatus = $("submitStatus");
const progressFill = $("progressFill");
const stepLabel = $("stepLabel");
const progressPct = $("progressPct");
const reviewBox = $("reviewBox");

let currentStep = 0;
let ready = true;

function toastStatus(el, msg, kind=""){
  el.textContent = msg || "";
  el.className = "status" + (kind ? (" " + kind) : "");
}

function showGate(show){
  connectGate.classList.toggle('is-on', !!show);
  form.style.display = show ? "none" : "block";
}

async function initBackend(){
  try{
    showGate(false);
    ready = true;
    toastStatus(connectStatus, "", "");
  }catch(e){
    console.error(e);
    showGate(true);
    toastStatus(connectStatus, 'Backend connection error: ' + (e?.message || e), 'bad');
    ready = false;
  }
}

retryConnectBtn?.addEventListener("click", initBackend);

function setStep(i){
  currentStep = Math.max(0, Math.min(steps.length-1, i));
  steps.forEach(s => s.classList.remove("is-active"));
  steps[currentStep].classList.add("is-active");

  stepperItems.forEach((b, idx)=>{
    b.classList.toggle("is-active", idx === currentStep);
    b.classList.toggle("is-done", idx < currentStep);
  });

  backBtn.disabled = currentStep === 0;
  nextBtn.style.display = currentStep === steps.length-1 ? "none" : "inline-block";
  backBtn.style.display = currentStep === steps.length-1 ? "none" : "inline-block";

  const pct = Math.round((currentStep/(steps.length-1))*100);
  progressFill.style.width = pct + "%";
  stepLabel.textContent = `Step ${currentStep+1} of ${steps.length}`;
  progressPct.textContent = pct + "%";

  if(currentStep === steps.length-1){
    buildReview();
  }
  window.scrollTo({top:0, behavior:"smooth"});
}

stepperItems.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const target = parseInt(btn.getAttribute("data-step"),10);
    if(Number.isFinite(target)) setStep(target);
  });
});

function getMultiSelectValues(sel){
  return Array.from(sel.selectedOptions).map(o=>o.value);
}

function getCheckedValues(name){
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map(i=>i.value);
}

function collectFormData(){
  const fd = new FormData(form);
  const obj = {};
  for(const [k,v] of fd.entries()){
    // files are handled separately
    if(v instanceof File) continue;
    obj[k] = v;
  }
  // Multi-select
  const servicesSel = form.querySelector('select[name="services"]');
  obj.services = servicesSel ? getMultiSelectValues(servicesSel) : [];
  // Days checkboxes
  obj.days = getCheckedValues("days");
  // System fields
  obj._client = {
    userAgent: navigator.userAgent,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null
  };
  return obj;
}

function validateStep(stepIdx){
  // Validate only inputs within the current step.
  const step = steps[stepIdx];
  const required = step.querySelectorAll("[required]");
  let ok = true;

  required.forEach(el=>{
    if(el.type === "file"){
      if(!el.files || el.files.length === 0){
        ok = false;
        el.style.borderColor = "rgba(239,68,68,0.65)";
      }else{
        el.style.borderColor = "";
      }
      return;
    }

    if(el.tagName === "SELECT" && el.multiple){
      const vals = Array.from(el.selectedOptions).map(o=>o.value);
      if(vals.length === 0){
        ok = false;
        el.style.borderColor = "rgba(239,68,68,0.65)";
      }else el.style.borderColor = "";
      return;
    }

    if(el.name === "days"){
      // handled below
      return;
    }

    if(!el.value || !String(el.value).trim()){
      ok = false;
      el.style.borderColor = "rgba(239,68,68,0.65)";
    }else{
      el.style.borderColor = "";
    }
  });

  // Special: days checkboxes in availability step
  if(step.querySelector('input[name="days"]')){
    const days = getCheckedValues("days");
    if(days.length === 0){
      ok = false;
      toastStatus(submitStatus, "Please select at least one available day.", "bad");
    }else{
      toastStatus(submitStatus, "", "");
    }
  }

  // Special: must be 18+ to proceed meaningfully
  if(stepIdx === 0){
    const age = form.querySelector('select[name="age18"]')?.value;
    if(age === "No"){
      ok = false;
      toastStatus(submitStatus, "You must be 18+ to submit.", "bad");
    }
  }

  // Background check consent
  if(stepIdx === 1){
    const bg = form.querySelector('select[name="bgConsent"]')?.value;
    if(bg === "No"){
      ok = false;
      toastStatus(submitStatus, "Background check consent is required for approval.", "bad");
    }
  }

  return ok;
}

backBtn.addEventListener("click", ()=> setStep(currentStep-1));
nextBtn.addEventListener("click", ()=>{
  toastStatus(submitStatus, "", "");
  if(!validateStep(currentStep)){
    toastStatus(submitStatus, "Please complete required fields in this step.", "bad");
    return;
  }
  setStep(currentStep+1);
});

resetBtn.addEventListener("click", ()=>{
  if(!confirm("Reset the entire form? This clears unsaved entries.")) return;
  form.reset();
  // clear borders
  form.querySelectorAll("input,select,textarea").forEach(el=> el.style.borderColor="");
  toastStatus(submitStatus, "Cleared.", "");
  setStep(0);
});

function draftKey(){ return "sol_mobile_detailer_draft_v2"; }

saveDraftBtn.addEventListener("click", ()=>{
  const data = collectFormData();
  // Note: files cannot be stored in localStorage; this saves the text fields only.
  localStorage.setItem(draftKey(), JSON.stringify({data, savedAt: new Date().toISOString()}));
  toastStatus(submitStatus, "Draft saved on this device (text fields only).", "ok");
});

resumeDraftBtn.addEventListener("click", ()=>{
  const raw = localStorage.getItem(draftKey());
  if(!raw){
    toastStatus(submitStatus, "No draft found on this device.", "bad");
    return;
  }
  try{
    const parsed = JSON.parse(raw);
    const data = parsed.data || {};
    // restore inputs
    Object.entries(data).forEach(([k,v])=>{
      const el = form.querySelector(`[name="${CSS.escape(k)}"]`);
      if(!el) return;
      if(el.tagName === "SELECT" && el.multiple && Array.isArray(v)){
        Array.from(el.options).forEach(o=> o.selected = v.includes(o.value));
        return;
      }
      if(el.type === "checkbox") return;
      el.value = v;
    });
    // days
    if(Array.isArray(data.days)){
      form.querySelectorAll('input[name="days"]').forEach(cb=>{
        cb.checked = data.days.includes(cb.value);
      });
    }
    toastStatus(submitStatus, "Draft restored (re-upload photos before submitting).", "ok");
  }catch(e){
    toastStatus(submitStatus, "Could not restore draft.", "bad");
  }
});

function scrub(obj){
  // remove empties
  const out = {};
  for(const [k,v] of Object.entries(obj)){
    if(v === null || v === undefined) continue;
    if(typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

function buildReview(){
  const data = collectFormData();
  const masked = {...data};
  // Do mild masking
  if(masked.dob) masked.dob = masked.dob;
  reviewBox.innerHTML = "";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(masked, null, 2);
  reviewBox.appendChild(pre);
}

async function uploadFiles(){
  const fileInputs = [
    ["photoLiving", "living"],
    ["photoSleep", "sleeping"],
    ["photoYard", "yard"],
    ["photoEntry", "entry"],
    ["photoID", "id_optional"]
  ];

  const result = {};
  for(const [inputName, bucket] of fileInputs){
    const inp = form.querySelector(`input[name="${inputName}"]`);
    if(!inp || !inp.files || inp.files.length === 0) continue;

    result[bucket] = await filesToPayload(inp.files);
  }
  return result;
}

function disableUI(disabled){
  submitStatus.classList.remove("ok","bad");
  form.querySelectorAll("input,select,textarea,button").forEach(el=>{
    if(el.id === 'retryConnectBtn') return;
    el.disabled = disabled;
  });
}

function makeId(){
  const rnd = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(rnd).map(b=>b.toString(16).padStart(2,"0")).join("");
}

form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  toastStatus(submitStatus, "", "");

  // Validate all steps quickly
  for(let i=0;i<steps.length;i++){
    if(i === steps.length-1) continue; // review step validates signature/agree via native
    setStep(i);
    if(!validateStep(i)){
      toastStatus(submitStatus, "Please complete required fields before submitting.", "bad");
      return;
    }
  }

  // Go to review and validate required fields there
  setStep(steps.length-1);

  if(!form.checkValidity()){
    form.reportValidity();
    toastStatus(submitStatus, "Missing required fields on review step.", "bad");
    return;
  }

  if(!ready){
    toastStatus(submitStatus, "Backend not ready. Retry the connection and submit again.", "bad");
    return;
  }

  const data = scrub(collectFormData());
  const submissionId = makeId();

  disableUI(true);
  toastStatus(submitStatus, "Uploading photos…", "");

  try{
    const uploads = await uploadFiles();

    toastStatus(submitStatus, "Finalizing submission…", "");

    await submitIntake(data, uploads, submissionId);

    toastStatus(submitStatus, "Submitted ✅ Thank you. Ops will review and contact you.", "ok");
    localStorage.removeItem(draftKey());
    form.reset();
    setStep(0);
  }catch(err){
    console.error(err);
    toastStatus(submitStatus, "Submit failed: " + (err?.message || err), "bad");
  }finally{
    disableUI(false);
  }
});

// Boot
setStep(0);
initBackend();
