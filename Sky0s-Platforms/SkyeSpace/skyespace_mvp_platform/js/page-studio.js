
(function(){
  const schedule = document.querySelector('#quick-schedule');
  schedule?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(schedule);
    window.SKYE_STATE.pushPost({
      author: window.SKYE_STATE.get().profile.name,
      role:'Studio Scheduler',
      type:'Scheduled',
      title: fd.get('headline'),
      text: `Queued for ${fd.get('when')} in ${fd.get('lane')}.`
    });
    schedule.reset();
    window.dispatchEvent(new CustomEvent('skye:update'));
  });
})();
