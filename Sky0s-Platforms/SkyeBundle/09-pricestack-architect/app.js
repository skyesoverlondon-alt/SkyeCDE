
const APP_KEY='SKYE_PRICESTACK_ARCHITECT_V1';
function getForm(){ return {offer:$('#price-offer').value.trim(), deposit:Number($('#price-deposit').value||40), tiers:lines($('#price-tiers').value).map(line=>{ const [label,price]=line.split('|').map(s=>s.trim()); return {label:label||'Tier', price:Number(String(price||'').replace(/[^0-9.]/g,''))||0};}), months:Number($('#price-months').value||6), rate:Number($('#price-rate').value||0), margin:Number($('#price-margin').value||65), notes:$('#price-notes').value.trim()};}
function renderStack(d){
  $('#price-cards').innerHTML = d.tiers.map(t=>{
    const deposit = t.price * d.deposit/100;
    const balance = t.price - deposit;
    const monthly = d.months ? (balance * (1 + d.rate/100)) / d.months : balance;
    const targetCost = t.price * (1 - d.margin/100);
    return `<div class="card">
      <div class="card-title">${t.label}</div>
      <div class="card-meta">$${t.price.toLocaleString()}</div>
      <div class="cards">
        <div class="kpi"><div class="v">$${deposit.toFixed(0)}</div><div class="l">Deposit</div></div>
        <div class="kpi"><div class="v">$${monthly.toFixed(0)}</div><div class="l">Monthly</div></div>
        <div class="kpi"><div class="v">$${targetCost.toFixed(0)}</div><div class="l">Target Cost Ceiling</div></div>
      </div>
      <div class="footer-note">${d.notes}</div>
    </div>`;
  }).join('');
}
$('#build-price-stack').addEventListener('click', ()=>{ const d=getForm(); store(APP_KEY,d); renderStack(d); });
$('#export-price-stack').addEventListener('click', ()=> downloadJSON('pricestack-architect.json', getForm()));
$('#export-app').addEventListener('click', ()=> downloadJSON('pricestack-architect.json', getForm()));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{ const d=await readJSONFile(e.target.files[0]); $('#price-offer').value=d.offer||''; $('#price-deposit').value=d.deposit||40; $('#price-tiers').value=(d.tiers||[]).map(t=>`${t.label} | ${t.price}`).join('\n'); $('#price-months').value=d.months||6; $('#price-rate').value=d.rate||0; $('#price-margin').value=d.margin||65; $('#price-notes').value=d.notes||''; renderStack(d); });
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); location.reload(); }});
const existing=load(APP_KEY,null); if(existing) renderStack(existing);
