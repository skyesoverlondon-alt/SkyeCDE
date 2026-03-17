
const APP_KEY='SKYE_CASE_STUDY_BUILDER_V1';
function getForm(){ return {client:$('#case-client').value.trim(), industry:$('#case-industry').value.trim(), problem:$('#case-problem').value.trim(), solution:$('#case-solution').value.trim(), results:lines($('#case-results').value), quote:$('#case-quote').value.trim()};}
function renderCase(d){
  $('#case-long').innerHTML = `<h2>${d.client}</h2><div class="card-meta">${d.industry}</div><h3>Problem</h3><div class="output code">${d.problem}</div><h3>Solution</h3><div class="output code">${d.solution}</div><h3>Results</h3>${d.results.map(r=>`<div class="card">${r}</div>`).join('')}<h3>Quote</h3><div class="card">${d.quote}</div>`;
  $('#case-onepager').innerHTML = `<div class="card"><div class="card-title">${d.client}</div><div class="card-meta">${d.industry}</div><div>${d.results.slice(0,3).join('<br>')}</div></div>`;
  $('#case-snippets').textContent = d.results.map((r,i)=>`Snippet ${i+1}: ${d.client} · ${r}`).join('\n\n');
}
$('#build-case-study').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderCase(d); });
$('#export-case-study').addEventListener('click', ()=>{ const d=getForm(); renderCase(d); downloadText(`${slugify(d.client || 'case-study')}.html`, `<!DOCTYPE html><html><body>${$('#case-long').innerHTML}</body></html>`, 'text/html'); });
$('#load-sample-case').addEventListener('click', ()=>{ const d={client:'Client',industry:'Industry',problem:'Problem',solution:'Solution',results:['Result 1','Result 2','Result 3'],quote:'Quote'}; $('#case-client').value=d.client; $('#case-industry').value=d.industry; $('#case-problem').value=d.problem; $('#case-solution').value=d.solution; $('#case-results').value=d.results.join('\n'); $('#case-quote').value=d.quote; renderCase(d); });
$('#export-app').addEventListener('click', ()=> downloadJSON('case-study-builder.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#case-client').value=d.client||''; $('#case-industry').value=d.industry||''; $('#case-problem').value=d.problem||''; $('#case-solution').value=d.solution||''; $('#case-results').value=(d.results||[]).join('\n'); $('#case-quote').value=d.quote||''; renderCase(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderCase(existing);
