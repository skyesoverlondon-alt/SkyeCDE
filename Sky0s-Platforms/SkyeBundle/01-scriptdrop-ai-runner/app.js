
const APP_KEY = 'SKYE_SCRIPTDROP_RUNNER_V1';
const SETTINGS_KEY = 'SKYE_SCRIPTDROP_SETTINGS_V1';
let stagedFiles = [];
let currentPack = load(APP_KEY, null);
const defaultPrompt = 'Build a runner pack with steps, objection handling, voicemail, SMS, email follow-up, assessment copy, and normalized JSON.';
$('#system-prompt').value = load(SETTINGS_KEY, {}).systemPrompt || defaultPrompt;
$('#endpoint-url').value = load(SETTINGS_KEY, {}).endpoint || '';
$('#endpoint-token').value = load(SETTINGS_KEY, {}).token || '';

function saveSettings(){
  store(SETTINGS_KEY, {
    endpoint: $('#endpoint-url').value.trim(),
    token: $('#endpoint-token').value.trim(),
    systemPrompt: $('#system-prompt').value.trim()
  });
}
['change','input'].forEach(evt=>{
  $('#endpoint-url').addEventListener(evt, saveSettings);
  $('#endpoint-token').addEventListener(evt, saveSettings);
  $('#system-prompt').addEventListener(evt, saveSettings);
});
$('#choose-files').addEventListener('click', ()=> $('#source-files').click());
$('#source-files').addEventListener('change', e=> stageFiles(Array.from(e.target.files || [])));
['dragenter','dragover'].forEach(evt => $('#dropzone').addEventListener(evt, e=>{ e.preventDefault(); $('#dropzone').classList.add('drag'); }));
['dragleave','drop'].forEach(evt => $('#dropzone').addEventListener(evt, e=>{ e.preventDefault(); $('#dropzone').classList.remove('drag'); }));
$('#dropzone').addEventListener('drop', e=> stageFiles(Array.from(e.dataTransfer.files || [])));

function stageFiles(files){
  stagedFiles = files;
  $('#source-status').textContent = files.length ? `${files.length} source file${files.length===1?'':'s'}` : 'No source files';
  $('#ingest-preview').textContent = files.map(f => `${f.name} · ${f.type || 'file'} · ${Math.round(f.size/1024)} KB`).join('\n') || 'No source files';
}
function normalizePack(pack){
  return {
    meta: {
      name: pack?.meta?.name || 'Runner Pack',
      version: pack?.meta?.version || '1.0.0',
      sourceNames: Array.isArray(pack?.meta?.sourceNames) ? pack.meta.sourceNames : []
    },
    settingsPatch: {
      goal: pack?.settingsPatch?.goal || '',
      tiers: pack?.settingsPatch?.tiers || '',
      repName: pack?.settingsPatch?.repName || '',
      repSig: pack?.settingsPatch?.repSig || '',
      sendTo: pack?.settingsPatch?.sendTo || ''
    },
    steps: Array.isArray(pack?.steps) ? pack.steps.map((s, i) => ({
      key: s.key || `STEP_${i+1}`,
      title: s.title || `Step ${i+1}`,
      desc: s.desc || '',
      script: s.script || '',
      choices: Array.isArray(s.choices) ? s.choices.map((c, j) => ({
        id: c.id || uid('choice'),
        label: c.label || `Choice ${j+1}`,
        next: c.next || ''
      })) : []
    })) : [],
    templates: Object.fromEntries(Object.entries(pack?.templates || {}).map(([k,v])=>[k, String(v ?? '')])),
    assessment: {
      headline: pack?.assessment?.headline || '',
      body: pack?.assessment?.body || ''
    },
    masterScriptIntro: pack?.masterScriptIntro || ''
  };
}
function splitIntoTemplates(text){
  const out = {};
  const blocks = textBlocks(text);
  blocks.forEach((block, i) => {
    const lower = block.toLowerCase();
    if(lower.includes('voicemail')) out[`voicemail_${i+1}`] = block;
    else if(lower.includes('sms')) out[`sms_${i+1}`] = block;
    else if(lower.includes('email')) out[`email_${i+1}`] = block;
  });
  if(!Object.keys(out).length){
    out.email_1 = `Subject: Follow-Up\n\n${blocks[0] || text.slice(0, 400)}`;
    out.sms_1 = (lines(text)[0] || '').slice(0, 160);
    out.voicemail_1 = (blocks[1] || blocks[0] || '').slice(0, 260);
  }
  return out;
}
function localPackFromText(text, sourceNames=[]){
  const blocks = textBlocks(text);
  const headingish = blocks.filter(b => /^([A-Z][A-Za-z0-9 /&:-]{2,80}|#+\s|Step\s+\d+|Objection)/.test(b.split('\n')[0]));
  const chunks = headingish.length >= 3 ? headingish : blocks;
  const steps = chunks.slice(0, 8).map((chunk, i) => {
    const lineList = lines(chunk);
    const title = lineList[0].replace(/^#+\s*/, '').slice(0, 80) || `Step ${i+1}`;
    const body = lineList.slice(1).join('\n').trim() || chunk;
    const firstSentence = (body.split(/(?<=[.!?])\s+/)[0] || body).slice(0, 280);
    return {
      key: slugify(title).toUpperCase().replace(/-/g,'_'),
      title,
      desc: lineList.slice(1,3).join(' ').slice(0, 180),
      script: body,
      choices: [
        {id: uid('engaged'), label: 'Engaged', next: i < Math.min(chunks.length,8)-1 ? slugify((chunks[i+1].split('\n')[0] || `STEP_${i+2}`)).toUpperCase().replace(/-/g,'_') : 'FOLLOW_UP'},
        {id: uid('defer'), label: 'Deferred', next: 'FOLLOW_UP'},
        {id: uid('no_answer'), label: 'No Answer', next: 'VOICEMAIL'}
      ]
    };
  });
  if(!steps.length){
    steps.push({
      key:'OPEN',
      title:'Open',
      desc:'Primary opener',
      script:text.slice(0,1000),
      choices:[{id:uid('next'),label:'Next',next:'FOLLOW_UP'}]
    });
  }
  steps.push({
    key:'VOICEMAIL',
    title:'Voicemail',
    desc:'Voicemail branch',
    script:(blocks.find(b=>/voicemail/i.test(b)) || blocks[0] || '').slice(0, 600),
    choices:[{id:uid('next'),label:'Follow-Up',next:'FOLLOW_UP'}]
  });
  steps.push({
    key:'FOLLOW_UP',
    title:'Follow-Up',
    desc:'Follow-up branch',
    script:(blocks.find(b=>/follow[- ]?up/i.test(b)) || blocks[1] || blocks[0] || '').slice(0, 600),
    choices:[{id:uid('done'),label:'Complete',next:''}]
  });
  return normalizePack({
    meta:{name:'Local Runner Pack', version:'1.0.0', sourceNames},
    steps,
    templates: splitIntoTemplates(text),
    assessment:{headline:'Assessment', body:(blocks[0] || '').slice(0, 1000)},
    masterScriptIntro:(blocks[0] || '').slice(0, 600)
  });
}
function renderPack(){
  $('#pack-status').textContent = currentPack ? currentPack.meta.name : 'No pack loaded';
  const runner = $('#runner-cards');
  const templates = $('#template-cards');
  runner.innerHTML = '';
  templates.innerHTML = '';
  $('#assessment-output').textContent = '';
  $('#meta-output').textContent = '';
  if(!currentPack){
    $('#assessment-output').textContent = 'No pack loaded';
    $('#meta-output').textContent = 'No pack loaded';
    return;
  }
  currentPack.steps.forEach(step => {
    const choices = (step.choices || []).map(c => `<span class="badge">${c.label}${c.next ? ` → ${c.next}` : ''}</span>`).join(' ');
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="card-title">${step.title}</div>
      <div class="card-meta code">${step.key}</div>
      <div>${step.desc || ''}</div>
      <hr class="sep">
      <div class="output code">${step.script || ''}</div>
      <div class="toolbar" style="margin-top:10px">${choices}</div>`;
    runner.appendChild(div);
  });
  Object.entries(currentPack.templates || {}).forEach(([key,val]) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="card-title">${key}</div><div class="output code">${val}</div>`;
    templates.appendChild(div);
  });
  $('#assessment-output').innerHTML = `<h3>${currentPack.assessment.headline || ''}</h3><div class="output code">${currentPack.assessment.body || ''}</div>`;
  $('#meta-output').textContent = JSON.stringify(currentPack, null, 2);
}
async function buildLocal(){
  const notes = $('#raw-notes').value.trim();
  let merged = notes;
  const sourceNames = [];
  for(const file of stagedFiles){
    sourceNames.push(file.name);
    const lower = file.name.toLowerCase();
    if(lower.endsWith('.json')){
      try{
        const data = await readJSONFile(file);
        currentPack = normalizePack(data.runnerPack || data.pack || data);
        store(APP_KEY, currentPack);
        renderPack();
        return;
      }catch(err){
        $('#ingest-preview').textContent = `JSON load failed\n${err.message}`;
        return;
      }
    }
    if(/\.(txt|md|csv|rtf)$/i.test(lower)){
      merged += `\n\n# ${file.name}\n` + await readTextFile(file);
    } else {
      merged += `\n\n# ${file.name}\n[Binary file staged for endpoint parse]`;
    }
  }
  currentPack = localPackFromText(merged, sourceNames);
  store(APP_KEY, currentPack);
  $('#ingest-preview').textContent = merged.slice(0, 8000);
  renderPack();
}
async function sendToEndpoint(){
  const endpoint = $('#endpoint-url').value.trim();
  if(!endpoint){
    $('#ingest-preview').textContent = 'Endpoint URL required';
    return;
  }
  const fd = new FormData();
  stagedFiles.forEach(file => fd.append('files', file, file.name));
  fd.append('notes', $('#raw-notes').value.trim());
  fd.append('systemPrompt', $('#system-prompt').value.trim() || defaultPrompt);
  try{
    $('#ingest-preview').textContent = 'Sending...';
    const res = await fetch(endpoint, {
      method:'POST',
      headers: $('#endpoint-token').value.trim() ? { Authorization: `Bearer ${$('#endpoint-token').value.trim()}` } : {},
      body: fd
    });
    const ct = res.headers.get('content-type') || '';
    let payload;
    if(ct.includes('application/json')){
      payload = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Non-JSON response\n${text.slice(0, 500)}`);
    }
    if(!res.ok || payload.ok === false){
      throw new Error(payload.error || `HTTP ${res.status}`);
    }
    currentPack = normalizePack(payload.runnerPack || payload.pack || payload);
    store(APP_KEY, currentPack);
    $('#ingest-preview').textContent = JSON.stringify(payload.meta || payload.sourceSummaries || payload, null, 2).slice(0, 8000);
    renderPack();
  }catch(err){
    $('#ingest-preview').textContent = `Endpoint parse failed\n${err.message}`;
  }
}
$('#parse-local').addEventListener('click', buildLocal);
$('#parse-remote').addEventListener('click', sendToEndpoint);
$('#apply-json').addEventListener('click', async()=>{
  if(!stagedFiles.length){ $('#ingest-preview').textContent = 'JSON file required'; return; }
  const jsonFile = stagedFiles.find(f=>/\.json$/i.test(f.name));
  if(!jsonFile){ $('#ingest-preview').textContent = 'JSON file required'; return; }
  try{
    const data = await readJSONFile(jsonFile);
    currentPack = normalizePack(data.runnerPack || data.pack || data);
    store(APP_KEY, currentPack);
    renderPack();
  }catch(err){
    $('#ingest-preview').textContent = `JSON load failed\n${err.message}`;
  }
});
$('#export-pack').addEventListener('click', ()=> currentPack && downloadJSON(`${slugify(currentPack.meta.name || 'runner-pack')}.json`, currentPack));
$('#revert-pack').addEventListener('click', ()=>{ currentPack = null; localStorage.removeItem(APP_KEY); renderPack(); });
$('#export-app').addEventListener('click', ()=> downloadJSON('scriptdrop-ai-runner.json', {settings: load(SETTINGS_KEY, {}), pack: currentPack}));
$('#import-app-trigger').addEventListener('click', ()=> $('#import-app').click());
$('#import-app').addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  try{
    const data = await readJSONFile(file);
    if(data.settings){
      $('#endpoint-url').value = data.settings.endpoint || '';
      $('#endpoint-token').value = data.settings.token || '';
      $('#system-prompt').value = data.settings.systemPrompt || defaultPrompt;
      saveSettings();
    }
    if(data.pack){
      currentPack = normalizePack(data.pack);
      store(APP_KEY, currentPack);
      renderPack();
    }
  }catch(err){
    $('#ingest-preview').textContent = err.message;
  }
});
$('#reset-app').addEventListener('click', ()=>{
  if(!confirm('Reset app state?')) return;
  localStorage.removeItem(APP_KEY); localStorage.removeItem(SETTINGS_KEY);
  currentPack = null; stagedFiles = [];
  $('#endpoint-url').value = ''; $('#endpoint-token').value = ''; $('#system-prompt').value = defaultPrompt; $('#raw-notes').value='';
  $('#ingest-preview').textContent=''; $('#source-status').textContent='No source files';
  renderPack();
});
renderPack();
