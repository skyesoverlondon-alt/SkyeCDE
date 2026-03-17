
const APP_KEY='SKYE_AUTHORITY_BINDER_V1';
function getForm(){ return {entity:$('#binder-entity').value.trim(),vertical:$('#binder-vertical').value.trim(),authority:$('#binder-authority').value.trim(),assets:lines($('#binder-assets').value),milestones:lines($('#binder-milestones').value),value:$('#binder-value').value.trim(),qa:lines($('#binder-qa').value)};}
function renderBinder(d){
  $('#binder-output').innerHTML = `<h2>${d.entity}</h2><div class="card-meta">${d.vertical}</div><h3>Authority</h3><div class="output code">${d.authority}</div><h3>Assets</h3>${d.assets.map(a=>`<div class="card">${a}</div>`).join('')}<h3>Milestones</h3>${d.milestones.map(m=>`<div class="card">${m}</div>`).join('')}<h3>Value</h3><div class="output code">${d.value}</div>`;
  $('#binder-qa-output').innerHTML = d.qa.map(line=>{ const [q,a]=line.split('|').map(s=>s.trim()); return `<div class="card"><div class="card-title">${q||''}</div><div>${a||''}</div></div>`; }).join('');
}
$('#build-binder').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderBinder(d); });
$('#export-binder-html').addEventListener('click', ()=> downloadText(`${slugify($('#binder-entity').value || 'authority-binder')}.html`, `<!DOCTYPE html><html><body>${$('#binder-output').innerHTML}${$('#binder-qa-output').innerHTML}</body></html>`, 'text/html'));
$('#export-app').addEventListener('click', ()=> downloadJSON('authority-binder-generator.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#binder-entity').value=d.entity||''; $('#binder-vertical').value=d.vertical||''; $('#binder-authority').value=d.authority||''; $('#binder-assets').value=(d.assets||[]).join('\n'); $('#binder-milestones').value=(d.milestones||[]).join('\n'); $('#binder-value').value=d.value||''; $('#binder-qa').value=(d.qa||[]).join('\n'); renderBinder(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderBinder(existing);
