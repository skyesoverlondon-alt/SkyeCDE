
const APP_KEY='SKYE_REVIEW_ROCKET_WRITER_V1';
function getForm(){ return {business:$('#review-business').value.trim(), url:$('#review-url').value.trim(), audience:$('#review-audience').value.trim(), trigger:$('#review-trigger').value.trim(), outcome:$('#review-outcome').value.trim(), tone:$('#review-tone').value.trim()};}
function renderPack(data){
  $('#review-email').textContent = `Subject: Review Request\n\n${data.business}\n\nOutcome: ${data.outcome}\nTrigger: ${data.trigger}\nAudience: ${data.audience}\nReview URL: ${data.url}\nTone: ${data.tone}`;
  $('#review-sms').textContent = `${data.business}: review request · ${data.outcome} · ${data.url}`.slice(0, 320);
  $('#review-qr').innerHTML = `<div class="card"><div class="card-title">${data.business}</div><div class="card-meta">Review URL</div><div class="output code">${data.url}</div><div class="badge">${data.trigger}</div></div>`;
}
$('#build-review-pack').addEventListener('click', ()=>{ const data=getForm(); store(APP_KEY,data); renderPack(data); });
$('#export-review-pack').addEventListener('click', ()=>{ const data=getForm(); renderPack(data); downloadText(`${slugify(data.business || 'review-pack')}.html`, `<!DOCTYPE html><html><body><pre>${$('#review-email').textContent}</pre><pre>${$('#review-sms').textContent}</pre>${$('#review-qr').innerHTML}</body></html>`, 'text/html'); });
$('#load-sample-review').addEventListener('click', ()=>{ const d={business:'Business',url:'https://review-link.example',audience:'Customers',trigger:'Completed service',outcome:'Fast review volume',tone:'Direct'}; $('#review-business').value=d.business; $('#review-url').value=d.url; $('#review-audience').value=d.audience; $('#review-trigger').value=d.trigger; $('#review-outcome').value=d.outcome; $('#review-tone').value=d.tone; renderPack(d); });
$('#export-app').addEventListener('click', ()=> downloadJSON('review-rocket-writer.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const f=e.target.files[0]; if(!f) return; const d=await readJSONFile(f); Object.entries({business:'#review-business',url:'#review-url',audience:'#review-audience',trigger:'#review-trigger',outcome:'#review-outcome',tone:'#review-tone'}).forEach(([k,sel])=>$(sel).value=d[k]||''); renderPack(d);});
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderPack(existing);
