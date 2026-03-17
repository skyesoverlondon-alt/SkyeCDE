
const APP_KEY='SKYE_INTAKEVAULT_LITE_V1';
let state=load(APP_KEY,{records:[]});
function getForm(){ return {client:$('#intake-client').value.trim(),contact:$('#intake-contact').value.trim(),email:$('#intake-email').value.trim(),phone:$('#intake-phone').value.trim(),needs:$('#intake-needs').value.trim(),budget:$('#intake-budget').value.trim(),risks:lines($('#intake-risks').value),next:$('#intake-next').value.trim()};}
function score(d){
  let points = 100;
  if(!d.email) points -= 20;
  if(!d.phone) points -= 10;
  if(d.risks.length) points -= d.risks.length * 8;
  if(!d.budget) points -= 12;
  return Math.max(5, points);
}
function render(){
  $('#intake-records').innerHTML = state.records.length ? state.records.map(r=>`<div class="card"><div class="card-title">${r.client}</div><div class="card-meta">${r.contact} · ${r.email}</div><div>${r.needs}</div></div>`).join('') : '<div class="small">No records</div>';
}
$('#save-intake-record').addEventListener('click', ()=>{ const d={...getForm(), id:uid('intake'), score:score(getForm())}; state.records.unshift(d); store(APP_KEY,state); render(); $('#intake-score').innerHTML = `<div class="kpi"><div class="v">${d.score}</div><div class="l">Qualification Score</div></div>`; });
$('#score-intake').addEventListener('click', ()=>{ const d=getForm(); $('#intake-score').innerHTML = `<div class="kpi"><div class="v">${score(d)}</div><div class="l">Qualification Score</div></div>`; });
$('#export-app').addEventListener('click', ()=> downloadJSON('intakevault-lite.json', state));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ state=await readJSONFile(e.target.files[0]); store(APP_KEY,state); render(); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); state={records:[]}; render(); $('#intake-score').innerHTML=''; }});
render();
