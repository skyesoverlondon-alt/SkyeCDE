
const APP_KEY='SKYE_COHORT_COMMAND_V1';
function getForm(){ return {name:$('#cohort-name').value.trim(), start:$('#cohort-start').value || new Date().toISOString().slice(0,10), seats:Number($('#cohort-seats').value||20), sessions:Number($('#cohort-session-count').value||8), modules:lines($('#cohort-modules').value), workbook:lines($('#cohort-workbook').value), roster:lines($('#cohort-roster').value)};}
function renderCohort(d){
  $('#cohort-plan').innerHTML = Array.from({length:d.sessions}).map((_,i)=>`<div class="card"><div class="card-title">Session ${i+1}</div><div>${d.modules[i] || d.modules[d.modules.length-1] || 'Module'}</div></div>`).join('');
  $('#cohort-roster-output').innerHTML = d.roster.map((name,i)=>`<div class="card"><div class="card-title">${name}</div><div class="card-meta">Seat ${i+1}</div></div>`).join('') || '<div class="small">No roster</div>';
  $('#cohort-certificate').innerHTML = `<div class="card"><div class="card-title">${d.name}</div><div class="card-meta">${d.start}</div><div>Certificate Template</div></div>`;
}
$('#build-cohort').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderCohort(d); });
$('#export-cohort').addEventListener('click', ()=> downloadText(`${slugify($('#cohort-name').value || 'cohort-command')}.html`, `<!DOCTYPE html><html><body>${$('#cohort-plan').innerHTML}${$('#cohort-roster-output').innerHTML}${$('#cohort-certificate').innerHTML}</body></html>`, 'text/html'));
$('#export-app').addEventListener('click', ()=> downloadJSON('cohort-command.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#cohort-name').value=d.name||''; $('#cohort-start').value=d.start||''; $('#cohort-seats').value=d.seats||20; $('#cohort-session-count').value=d.sessions||8; $('#cohort-modules').value=(d.modules||[]).join('\n'); $('#cohort-workbook').value=(d.workbook||[]).join('\n'); $('#cohort-roster').value=(d.roster||[]).join('\n'); renderCohort(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderCohort(existing);
