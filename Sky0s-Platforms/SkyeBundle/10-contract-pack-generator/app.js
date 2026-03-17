
const APP_KEY='SKYE_CONTRACT_PACK_V1';
function getForm(){ return {provider:$('#contract-provider').value.trim(), client:$('#contract-client').value.trim(), service:$('#contract-service').value.trim(), date:$('#contract-date').value || new Date().toISOString().slice(0,10), scope:$('#contract-scope').value.trim(), milestones:lines($('#contract-milestones').value), payments:$('#contract-payments').value.trim(), ip:$('#contract-ip').value.trim(), cancel:$('#contract-cancel').value.trim()};}
function renderPack(d){
  $('#contract-agreement').textContent = `Provider: ${d.provider}\nClient: ${d.client}\nService: ${d.service}\nEffective Date: ${d.date}\n\nScope\n${d.scope}\n\nPayment Terms\n${d.payments}\n\nIP / Ownership\n${d.ip}\n\nCancellation / Change Control\n${d.cancel}`;
  $('#contract-checklist').innerHTML = ['Entity details','Primary contact','Billing details','Access credentials','Success criteria'].map(item=>`<div class="card">${item}</div>`).join('');
  $('#contract-schedule').innerHTML = d.milestones.map((m,i)=>`<div class="card"><div class="card-title">Milestone ${i+1}</div>${m}</div>`).join('');
}
$('#build-contract-pack').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderPack(d); });
$('#export-contract-pack').addEventListener('click', ()=> downloadText(`${slugify($('#contract-client').value || 'contract-pack')}.html`, `<!DOCTYPE html><html><body><pre>${$('#contract-agreement').textContent}</pre>${$('#contract-checklist').innerHTML}${$('#contract-schedule').innerHTML}</body></html>`, 'text/html'));
$('#export-app').addEventListener('click', ()=> downloadJSON('contract-pack-generator.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#contract-provider').value=d.provider||''; $('#contract-client').value=d.client||''; $('#contract-service').value=d.service||''; $('#contract-date').value=d.date||''; $('#contract-scope').value=d.scope||''; $('#contract-milestones').value=(d.milestones||[]).join('\n'); $('#contract-payments').value=d.payments||''; $('#contract-ip').value=d.ip||''; $('#contract-cancel').value=d.cancel||''; renderPack(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderPack(existing);
