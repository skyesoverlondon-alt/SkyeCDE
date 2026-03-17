
(function(){
  const page = document.body.dataset.page;

  function applyNav(){
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === page);
    });
  }

  function syncProfileName(){
    const state = window.SKYE_STATE.get();
    document.querySelectorAll('[data-profile-name]').forEach(node => node.textContent = state.profile.name);
  }

  function syncButtons(){
    const state = window.SKYE_STATE.get();
    document.querySelectorAll('[data-toggle-save]').forEach(btn => {
      const id = btn.dataset.toggleSave;
      btn.textContent = state.saves[id] ? 'Saved' : 'Save';
    });
    document.querySelectorAll('[data-join]').forEach(btn => {
      const id = btn.dataset.join;
      btn.textContent = state.joins[id] ? 'Joined' : 'Join';
    });
    document.querySelectorAll('[data-vote]').forEach(btn => {
      const id = btn.dataset.vote;
      btn.textContent = state.votes[id] ? 'Voted' : 'Cast vote';
    });
    document.querySelectorAll('[data-enroll]').forEach(btn => {
      const id = btn.dataset.enroll;
      btn.textContent = state.enrollments[id] ? 'Enrolled' : 'Enroll';
    });
  }

  function openComposer(){ document.querySelector('.composer-backdrop')?.classList.add('open'); }
  function closeComposer(){ document.querySelector('.composer-backdrop')?.classList.remove('open'); }

  document.addEventListener('click', e => {
    const openBtn = e.target.closest('[data-open-composer]');
    if(openBtn){ openComposer(); return; }

    const closeBtn = e.target.closest('[data-close-composer]');
    if(closeBtn){ closeComposer(); return; }

    if(e.target.classList.contains('composer-backdrop')){ closeComposer(); return; }

    const saveBtn = e.target.closest('[data-toggle-save]');
    if(saveBtn){
      const id = saveBtn.dataset.toggleSave;
      window.SKYE_STATE.toggle('saves', id);
      syncButtons();
      return;
    }

    const joinBtn = e.target.closest('[data-join]');
    if(joinBtn){
      const id = joinBtn.dataset.join;
      window.SKYE_STATE.toggle('joins', id);
      syncButtons();
      return;
    }

    const voteBtn = e.target.closest('[data-vote]');
    if(voteBtn){
      const id = voteBtn.dataset.vote;
      window.SKYE_STATE.toggle('votes', id);
      syncButtons();
      return;
    }

    const enrollBtn = e.target.closest('[data-enroll]');
    if(enrollBtn){
      const id = enrollBtn.dataset.enroll;
      window.SKYE_STATE.toggle('enrollments', id);
      syncButtons();
      return;
    }
  });

  const searchInput = document.querySelector('[data-global-search]');
  if(searchInput){
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      document.querySelectorAll('[data-searchable]').forEach(node => {
        const hay = node.textContent.toLowerCase();
        node.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }

  const form = document.querySelector('#quick-compose-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const state = window.SKYE_STATE.get();
    const lane = fd.get('lane');
    const payload = {
      author: state.profile.name,
      title: fd.get('title'),
      text: fd.get('body'),
      category: fd.get('category'),
      lane,
      ts: Date.now(),
      mine: true
    };
    if(lane === 'market'){
      window.SKYE_STATE.pushListing({
        title: payload.title,
        category: payload.category || 'Custom Offer',
        price: fd.get('price') || '$—',
        seller: state.profile.name,
        eta: fd.get('eta') || 'Flexible',
        district: fd.get('district') || 'Custom'
      });
    }else if(lane === 'signal'){
      window.SKYE_STATE.pushSignal({
        severity: fd.get('severity') || 'medium',
        title: payload.title,
        detail: payload.text,
        source: state.profile.name,
        age: 'just now'
      });
    }else if(lane === 'messages'){
      window.SKYE_STATE.pushMessage({
        author: state.profile.name,
        body: payload.text || payload.title,
        mine: true,
        ts: Date.now()
      });
    }else{
      window.SKYE_STATE.pushPost({
        author: state.profile.name,
        role: payload.category || 'Custom',
        type: lane.charAt(0).toUpperCase() + lane.slice(1),
        title: payload.title,
        text: payload.text
      });
    }
    form.reset();
    closeComposer();
    window.dispatchEvent(new CustomEvent('skye:update'));
  });

  function syncAll(){
    applyNav();
    syncProfileName();
    syncButtons();
  }
  syncAll();
  window.addEventListener('skye:update', syncAll);
})();
