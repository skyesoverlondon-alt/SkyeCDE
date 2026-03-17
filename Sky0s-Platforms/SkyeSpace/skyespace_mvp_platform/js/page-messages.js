
(function(){
  function fmt(ts){
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  }
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();
    document.querySelector('#message-preview-list').innerHTML = data.messages.map(msg => `
      <article class="message-preview" data-searchable>
        <div class="meta"><span>${msg.from}</span><span>${msg.topic}</span></div>
        <p>${msg.preview}</p>
      </article>
    `).join('');

    document.querySelector('#thread').innerHTML = state.quickMessages.map(msg => `
      <div class="bubble ${msg.mine ? 'me' : ''}">
        <div class="meta"><span>${msg.mine ? 'You' : msg.author}</span><span>${fmt(msg.ts)}</span></div>
        <div>${msg.body}</div>
      </div>
    `).join('');
  }
  const form = document.querySelector('#message-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const body = form.body.value.trim();
    if(!body) return;
    window.SKYE_STATE.pushMessage({author:window.SKYE_STATE.get().profile.name, body, mine:true, ts:Date.now()});
    form.reset();
    window.dispatchEvent(new CustomEvent('skye:update'));
  });
  render();
  window.addEventListener('skye:update', render);
})();
