
(function(){
  const form = document.querySelector('#profile-form');
  const state = window.SKYE_STATE.get();
  form.name.value = state.profile.name;
  form.handle.value = state.profile.handle;
  form.title.value = state.profile.title;
  form.bio.value = state.profile.bio;
  form.addEventListener('submit', e => {
    e.preventDefault();
    window.SKYE_STATE.setProfile({
      name: form.name.value,
      handle: form.handle.value,
      title: form.title.value,
      bio: form.bio.value
    });
    window.dispatchEvent(new CustomEvent('skye:update'));
  });

  function render(){
    const p = window.SKYE_STATE.get().profile;
    document.querySelector('#profile-name').textContent = p.name;
    document.querySelector('#profile-handle').textContent = p.handle;
    document.querySelector('#profile-title').textContent = p.title;
    document.querySelector('#profile-bio').textContent = p.bio;
  }
  render();
  window.addEventListener('skye:update', render);
})();
