
const APP_KEY='SKYE_AE_ROUTE_PLANNER_V1';
function getForm(){ return {stops:lines($('#route-stops').value).map(line=>{ const [business,address,zone] = line.split('|').map(s=>s.trim()); return {business:business||'', address:address||'', zone:zone||'General'}; }).filter(x=>x.business), days:Number($('#route-days').value||5), start:$('#route-start').value || new Date().toISOString().slice(0,10), rep:$('#route-rep').value.trim()};}
function plan(d){
  const zones = [...new Set(d.stops.map(s=>s.zone))];
  return d.stops.map((stop, i)=>({ ...stop, day: (zones.indexOf(stop.zone) % d.days) + 1, order: i+1 }));
}
function renderPlan(d){
  const planned = plan(d);
  const grouped = planned.reduce((acc,row)=>{ (acc[row.day] ||= []).push(row); return acc; }, {});
  $('#route-days-output').innerHTML = Array.from({length:d.days}).map((_,i)=>`
    <div class="card">
      <div class="card-title">Day ${i+1}</div>
      ${(grouped[i+1] || []).map(stop=>`<div class="card"><div class="card-meta">${stop.zone}</div>${stop.business}<br>${stop.address}</div>`).join('') || '<div class="small">No stops</div>'}
    </div>`).join('');
  $('#route-sheet').textContent = planned.map(stop=>`Day ${stop.day} · ${stop.business} · ${stop.address} · ${stop.zone}`).join('\n');
}
$('#build-route').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderPlan(d); });
$('#export-route-csv').addEventListener('click', ()=> downloadText('ae-route-planner-pro.csv', rowsToCSV(plan(getForm())), 'text/csv'));
$('#export-app').addEventListener('click', ()=> downloadJSON('ae-route-planner-pro.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#route-stops').value=(d.stops||[]).map(s=>`${s.business} | ${s.address} | ${s.zone}`).join('\n'); $('#route-days').value=d.days||5; $('#route-start').value=d.start||''; $('#route-rep').value=d.rep||''; renderPlan(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderPlan(existing);
