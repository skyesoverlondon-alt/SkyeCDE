
const APP_KEY='SKYE_SERVICE_PAGE_GEN_V1';
function getForm(){ return {
  service:$('#service-name').value.trim(), city:$('#service-city').value.trim(), brand:$('#service-brand').value.trim(), cta:$('#service-cta').value.trim(),
  summary:$('#service-summary').value.trim(), proof:lines($('#service-proof').value), faqs:lines($('#service-faqs').value), steps:lines($('#service-steps').value)
};}
function renderPage(data){
  $('#page-preview').innerHTML = `
    <section class="stack">
      <div class="card"><div class="card-title">${data.service || 'Service'} · ${data.city || ''}</div><div class="card-meta">${data.brand || ''}</div><div>${data.summary}</div><div class="toolbar" style="margin-top:10px"><span class="badge">${data.cta || 'CTA'}</span></div></div>
      <div class="card"><div class="card-title">Proof</div>${data.proof.map(p=>`<div class="card">${p}</div>`).join('')}</div>
      <div class="card"><div class="card-title">Process</div>${data.steps.map((s,i)=>`<div class="card"><div class="card-meta">Step ${i+1}</div>${s}</div>`).join('')}</div>
      <div class="card"><div class="card-title">FAQs</div>${data.faqs.map(line=>{ const [q,a] = line.split('|').map(s=>s.trim()); return `<div class="card"><div class="card-meta">${q || ''}</div>${a || ''}</div>`; }).join('')}</div>
    </section>`;
}
$('#generate-page').addEventListener('click', ()=>{ const data=getForm(); store(APP_KEY,data); renderPage(data); });
$('#export-page-html').addEventListener('click', ()=>{ const data=getForm(); renderPage(data); const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.service} ${data.city}</title></head><body>${$('#page-preview').innerHTML}</body></html>`; downloadText(`${slugify(data.service + '-' + data.city)}.html`, html, 'text/html'); });
$('#load-sample-page').addEventListener('click', ()=>{ const s={service:'Service',city:'Phoenix',brand:'Brand',cta:'Book Review',summary:'Primary service summary.',proof:['Proof point 1','Proof point 2'],faqs:['What is included? | Scope.','How long? | Timeline.'],steps:['Discovery','Build','Launch']}; $('#service-name').value=s.service; $('#service-city').value=s.city; $('#service-brand').value=s.brand; $('#service-cta').value=s.cta; $('#service-summary').value=s.summary; $('#service-proof').value=s.proof.join('\n'); $('#service-faqs').value=s.faqs.join('\n'); $('#service-steps').value=s.steps.join('\n'); renderPage(s); });
$('#export-app').addEventListener('click', ()=> downloadJSON('service-page-generator-x.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const f=e.target.files[0]; if(!f) return; const d=await readJSONFile(f); Object.entries({service:'#service-name',city:'#service-city',brand:'#service-brand',cta:'#service-cta',summary:'#service-summary'}).forEach(([k,sel])=>$(sel).value=d[k]||''); $('#service-proof').value=(d.proof||[]).join('\n'); $('#service-faqs').value=(d.faqs||[]).join('\n'); $('#service-steps').value=(d.steps||[]).join('\n'); renderPage(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing = load(APP_KEY,null); if(existing) renderPage(existing);
