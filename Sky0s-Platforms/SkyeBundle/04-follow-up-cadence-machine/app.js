
const APP_KEY='SKYE_CADENCE_MACHINE_V1';
let state=load(APP_KEY,{library:[]});
function getForm(){ return {
  offer:$('#cadence-offer').value.trim(),
  audience:$('#cadence-audience').value.trim(),
  days:Number($('#cadence-days').value||10),
  start:$('#cadence-start').value || new Date().toISOString().slice(0,10),
  cta:$('#cadence-cta').value.trim(),
  voice:$('#cadence-voice').value.trim(),
  proof:$('#cadence-proof').value.trim(),
  notes:$('#cadence-notes').value.trim()
};}
function formatDate(base, add){
  const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate()+add); return d.toISOString().slice(0,10);
}
function buildCadence(form){
  const channels = ['Email','SMS','Voicemail','Email','SMS'];
  const actions = [];
  for(let i=0;i<form.days;i++){
    const channel = channels[i % channels.length];
    const focus = i===0 ? 'Open' : i<form.days-2 ? 'Follow-Up' : 'Close';
    const message = `${channel} · ${focus}\nOffer: ${form.offer}\nAudience: ${form.audience}\nProof: ${form.proof}\nCTA: ${form.cta}\nVoice: ${form.voice}\nNotes: ${form.notes}`;
    actions.push({day:i+1, date:formatDate(form.start, i), channel, focus, message});
  }
  return actions;
}
function renderCadence(form){
  const actions = buildCadence(form);
  $('#cadence-timeline').innerHTML = actions.map(item=>`
    <div class="card">
      <div class="card-title">Day ${item.day} · ${item.channel}</div>
      <div class="card-meta">${item.date} · ${item.focus}</div>
      <div>${item.message.replace(/\n/g,'<br>')}</div>
    </div>`).join('');
  $('#cadence-messages').textContent = actions.map(item=>`DAY ${item.day} · ${item.channel}\n${item.message}`).join('\n\n');
  return actions;
}
function renderLibrary(){
  $('#cadence-library').innerHTML = state.library.length ? state.library.map(item=>`
    <div class="card">
      <div class="card-title">${item.offer || 'Cadence'}</div>
      <div class="card-meta">${item.days} days · ${item.start}</div>
      <div class="toolbar">
        <button data-load="${item.id}">Load</button>
        <button data-delete="${item.id}" class="danger">Delete</button>
      </div>
    </div>`).join('') : '<div class="small">No saved cadences</div>';
  $$('[data-load]', $('#cadence-library')).forEach(btn=>btn.addEventListener('click', ()=>{
    const x=state.library.find(i=>i.id===btn.dataset.load); if(!x) return;
    $('#cadence-offer').value=x.offer||''; $('#cadence-audience').value=x.audience||''; $('#cadence-days').value=x.days||10; $('#cadence-start').value=x.start||''; $('#cadence-cta').value=x.cta||''; $('#cadence-voice').value=x.voice||''; $('#cadence-proof').value=x.proof||''; $('#cadence-notes').value=x.notes||''; renderCadence(x);
  }));
  $$('[data-delete]', $('#cadence-library')).forEach(btn=>btn.addEventListener('click', ()=>{ state.library=state.library.filter(i=>i.id!==btn.dataset.delete); store(APP_KEY,state); renderLibrary(); }));
}
$('#build-cadence').addEventListener('click', ()=> renderCadence(getForm()));
$('#save-cadence').addEventListener('click', ()=>{ const form={...getForm(), id:uid('cadence')}; state.library.unshift(form); state.library=state.library.slice(0,30); store(APP_KEY,state); renderLibrary(); renderCadence(form); });
$('#export-cadence-csv').addEventListener('click', ()=>{ const actions=buildCadence(getForm()); downloadText('follow-up-cadence.csv', rowsToCSV(actions), 'text/csv'); });
$('#export-app').addEventListener('click', ()=> downloadJSON('follow-up-cadence-machine.json', state));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const f=e.target.files[0]; if(!f) return; state=await readJSONFile(f); store(APP_KEY,state); renderLibrary(); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); state={library:[]}; renderLibrary(); $('#cadence-timeline').innerHTML=''; $('#cadence-messages').textContent=''; }});
renderLibrary();
