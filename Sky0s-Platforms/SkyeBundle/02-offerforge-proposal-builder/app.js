
const APP_KEY='SKYE_OFFERFORGE_V1';
let state = load(APP_KEY, {library:[]});
function getForm(){
  return {
    client: $('#client-name').value.trim(),
    contact: $('#client-contact').value.trim(),
    company: $('#company-name').value.trim(),
    date: $('#prepared-date').value || new Date().toISOString().slice(0,10),
    summary: $('#offer-summary').value.trim(),
    deliverables: lines($('#deliverables').value),
    pricing: lines($('#pricing-lines').value).map(line => {
      const [label, amount] = line.split('|').map(s=>s.trim());
      return { label: label || 'Line Item', amount: Number(String(amount||'').replace(/[^0-9.]/g,'')) || 0 };
    }).filter(x=>x.label),
    depositPct: Number($('#deposit-pct').value || 40),
    termLength: $('#term-length').value.trim(),
    timeline: $('#timeline').value.trim(),
    terms: $('#terms').value.trim(),
    proof: $('#proof-notes').value.trim()
  };
}
function setForm(data){
  $('#client-name').value = data.client || '';
  $('#client-contact').value = data.contact || '';
  $('#company-name').value = data.company || '';
  $('#prepared-date').value = data.date || new Date().toISOString().slice(0,10);
  $('#offer-summary').value = data.summary || '';
  $('#deliverables').value = (data.deliverables || []).join('\n');
  $('#pricing-lines').value = (data.pricing || []).map(x => `${x.label} | ${x.amount}`).join('\n');
  $('#deposit-pct').value = data.depositPct ?? 40;
  $('#term-length').value = data.termLength || '';
  $('#timeline').value = data.timeline || '';
  $('#terms').value = data.terms || '';
  $('#proof-notes').value = data.proof || '';
}
function renderProposal(data){
  const total = data.pricing.reduce((sum,x)=>sum+x.amount,0);
  const deposit = total * (data.depositPct/100);
  $('#proposal-output').innerHTML = `
    <h2>${data.company || 'Proposal'}</h2>
    <div class="small">${data.client || ''} ${data.contact ? '· ' + data.contact : ''} ${data.date ? '· ' + data.date : ''}</div>
    <hr class="sep">
    <h3>Scope</h3>
    <div class="output code">${data.summary}</div>
    <h3>Deliverables</h3>
    <div class="cards">${data.deliverables.map(d=>`<div class="card">${d}</div>`).join('')}</div>
    <h3>Timeline</h3>
    <div class="card">${data.timeline || ''}</div>
    <h3>Terms</h3>
    <div class="output code">${data.terms}</div>
    <h3>Proof</h3>
    <div class="output code">${data.proof}</div>`;
  $('#pricing-cards').innerHTML = data.pricing.map(item => `
    <div class="card">
      <div class="card-title">${item.label}</div>
      <div class="card-meta">$${item.amount.toLocaleString()}</div>
    </div>`).join('') + `
    <div class="card"><div class="card-title">Total</div><div class="card-meta">$${total.toLocaleString()}</div></div>
    <div class="card"><div class="card-title">Deposit</div><div class="card-meta">$${deposit.toLocaleString()} · ${data.depositPct}% </div></div>
    <div class="card"><div class="card-title">Term</div><div class="card-meta">${data.termLength || ''}</div></div>`;
}
function renderLibrary(){
  $('#proposal-library').innerHTML = state.library.length ? state.library.map(item => `
    <div class="card">
      <div class="card-title">${item.company || 'Proposal'}</div>
      <div class="card-meta">${item.client || ''} · ${item.date || ''}</div>
      <div class="toolbar">
        <button data-load="${item.id}">Load</button>
        <button data-delete="${item.id}" class="danger">Delete</button>
      </div>
    </div>`).join('') : '<div class="small">No saved snapshots</div>';
  $$('[data-load]', $('#proposal-library')).forEach(btn => btn.addEventListener('click', () => {
    const item = state.library.find(x=>x.id===btn.dataset.load);
    if(item){ setForm(item); renderProposal(item); }
  }));
  $$('[data-delete]', $('#proposal-library')).forEach(btn => btn.addEventListener('click', () => {
    state.library = state.library.filter(x=>x.id!==btn.dataset.delete);
    store(APP_KEY, state); renderLibrary();
  }));
}
$('#generate-proposal').addEventListener('click', ()=> renderProposal(getForm()));
$('#save-proposal').addEventListener('click', ()=>{
  const form = {...getForm(), id: uid('proposal')};
  state.library.unshift(form);
  state.library = state.library.slice(0, 30);
  store(APP_KEY, state); renderLibrary(); renderProposal(form);
});
$('#load-sample-proposal').addEventListener('click', ()=>{
  const sample = {
    client:'Prospect',
    contact:'Decision Maker',
    company:'Offer Package',
    date:new Date().toISOString().slice(0,10),
    summary:'Offer scope',
    deliverables:['Discovery','Build','QA','Launch'],
    pricing:[{label:'Build',amount:6500},{label:'Launch',amount:2500},{label:'Support',amount:1800}],
    depositPct:40,
    termLength:'30 days',
    timeline:'4 weeks',
    terms:'Deposit due on approval.\nBalance by milestone.',
    proof:'Prior operator results.'
  };
  setForm(sample); renderProposal(sample);
});
$('#export-proposal-html').addEventListener('click', ()=>{
  const data = getForm(); renderProposal(data);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.company || 'Proposal'}</title></head><body>${$('#proposal-output').innerHTML}<hr><div>${$('#pricing-cards').innerHTML}</div></body></html>`;
  downloadText(`${slugify(data.company || 'proposal')}.html`, html, 'text/html');
});
$('#export-app').addEventListener('click', ()=> downloadJSON('offerforge-proposals.json', state));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  const data = await readJSONFile(file); state = data; store(APP_KEY, state); renderLibrary();
});
$('#reset-app').addEventListener('click', ()=>{ if(confirm('Reset app state?')){ localStorage.removeItem(APP_KEY); state={library:[]}; renderLibrary(); $('#proposal-output').textContent=''; $('#pricing-cards').innerHTML=''; }});
renderLibrary();
