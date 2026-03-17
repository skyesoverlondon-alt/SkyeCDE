
const APP_KEY='SKYE_VIDEO_IDEA_ENGINE_V1';
function getForm(){ return {series:$('#video-series').value.trim(), audience:$('#video-audience').value.trim(), platform:$('#video-platform').value.trim(), episodes:Number($('#video-episodes').value||12), topics:lines($('#video-topics').value), positioning:$('#video-positioning').value.trim()};}
function buildPlan(d){
  const topics = d.topics.length ? d.topics : ['Topic'];
  return Array.from({length:d.episodes}).map((_,i)=>{
    const topic = topics[i % topics.length];
    return {
      episode:i+1,
      topic,
      title:`${topic}: ${d.positioning || d.series}`,
      hook:`${topic} · ${d.audience} · ${d.platform}`,
      shorts:`${topic} clip A · ${topic} clip B`
    };
  });
}
function renderPlan(d){
  const plan=buildPlan(d);
  $('#video-episodes-output').innerHTML = plan.map(p=>`<div class="card"><div class="card-title">Episode ${p.episode}</div><div class="card-meta">${p.topic}</div><div>${p.title}</div></div>`).join('');
  $('#video-hooks').textContent = plan.map(p=>`EP ${p.episode}: ${p.hook}`).join('\n');
  $('#video-shorts').textContent = plan.map(p=>`EP ${p.episode}: ${p.shorts}`).join('\n');
}
$('#build-video-plan').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderPlan(d); });
$('#export-video-plan').addEventListener('click', ()=> downloadText('video-idea-engine.csv', rowsToCSV(buildPlan(getForm())), 'text/csv'));
$('#export-app').addEventListener('click', ()=> downloadJSON('video-idea-engine.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#video-series').value=d.series||''; $('#video-audience').value=d.audience||''; $('#video-platform').value=d.platform||''; $('#video-episodes').value=d.episodes||12; $('#video-topics').value=(d.topics||[]).join('\n'); $('#video-positioning').value=d.positioning||''; renderPlan(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderPlan(existing);
