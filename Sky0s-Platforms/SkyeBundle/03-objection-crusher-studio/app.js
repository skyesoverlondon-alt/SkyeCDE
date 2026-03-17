
const APP_KEY='SKYE_OBJECTION_CRUSHER_V1';
let state = load(APP_KEY,{library:[], current:null});
function getForm(){ return {
  offer:$('#offer').value.trim(), audience:$('#audience').value.trim(), price:$('#price-point').value.trim(),
  value:$('#core-value').value.trim(), objections:lines($('#objections').value)
};}
function setForm(d){ $('#offer').value=d.offer||''; $('#audience').value=d.audience||''; $('#price-point').value=d.price||''; $('#core-value').value=d.value||''; $('#objections').value=(d.objections||[]).join('\n'); }
function buildResponses(form){
  return form.objections.map((obj, i)=>({
    objection: obj,
    acknowledge:`Valid concern: ${obj}.`,
    probe:`Decision criteria: ${form.audience || 'buyer'} · current gap · timeline.`,
    reposition:`Value path: ${form.value || form.offer}.`,
    close:`Advance: review scope · confirm fit · move to next step.`,
    variant_fast:`Condensed response: ${obj} → fit → value → next step.`,
    variant_detail:`Expanded response: ${obj}\nCurrent state\nGap\nRisk of delay\n${form.offer}\n${form.value}\nAdvance.`
  }));
}
function renderCurrent(form){
  const responses = buildResponses(form);
  $('#objection-cards').innerHTML = responses.map((r, idx)=>`
    <div class="card">
      <div class="card-title">${idx+1}. ${r.objection}</div>
      <div class="cards">
        <div class="card"><div class="card-meta">Acknowledge</div>${r.acknowledge}</div>
        <div class="card"><div class="card-meta">Probe</div>${r.probe}</div>
        <div class="card"><div class="card-meta">Reposition</div>${r.reposition}</div>
        <div class="card"><div class="card-meta">Close</div>${r.close}</div>
      </div>
    </div>`).join('');
  $('#roleplay-output').textContent = responses.map((r, i)=>`SCENARIO ${i+1}\nOBJECTION: ${r.objection}\nSHORT: ${r.variant_fast}\nDETAILED:\n${r.variant_detail}`).join('\n\n');
}
function renderLibrary(){
  $('#objection-library').innerHTML = state.library.length ? state.library.map(item=>`
    <div class="card">
      <div class="card-title">${item.offer || 'Set'}</div>
      <div class="card-meta">${item.objections.length} objections</div>
      <div class="toolbar">
        <button data-load="${item.id}">Load</button>
        <button data-delete="${item.id}" class="danger">Delete</button>
      </div>
    </div>`).join('') : '<div class="small">No saved sets</div>';
  $$('[data-load]', $('#objection-library')).forEach(btn=>btn.addEventListener('click', ()=>{
    const item = state.library.find(x=>x.id===btn.dataset.load); if(item){ setForm(item); renderCurrent(item); }
  }));
  $$('[data-delete]', $('#objection-library')).forEach(btn=>btn.addEventListener('click', ()=>{
    state.library = state.library.filter(x=>x.id!==btn.dataset.delete); store(APP_KEY,state); renderLibrary();
  }));
}
$('#generate-objections').addEventListener('click', ()=> renderCurrent(getForm()));
$('#save-objection-set').addEventListener('click', ()=>{ const form={...getForm(), id:uid('set')}; state.library.unshift(form); store(APP_KEY,state); renderLibrary(); renderCurrent(form); });
$('#load-sample-objections').addEventListener('click', ()=>{ const sample={offer:'Offer',audience:'Owner',price:'15000',value:'Faster conversion system',objections:['Too expensive','No time','Already working with someone']}; setForm(sample); renderCurrent(sample); });
$('#export-app').addEventListener('click', ()=> downloadJSON('objection-crusher.json', state));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const f=e.target.files[0]; if(!f) return; state=await readJSONFile(f); store(APP_KEY,state); renderLibrary(); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); state={library:[], current:null}; renderLibrary(); $('#objection-cards').innerHTML=''; $('#roleplay-output').textContent=''; }});
renderLibrary();
