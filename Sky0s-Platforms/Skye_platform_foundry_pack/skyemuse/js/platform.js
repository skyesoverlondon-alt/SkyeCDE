
(function(){
  const setActive = ()=>{
    const page = document.body.dataset.page;
    document.querySelectorAll('[data-nav]').forEach(a=>{
      if(a.dataset.nav === page) a.classList.add('active');
    });
  };
  const tick = ()=>{
    const el = document.querySelector('[data-live-clock]');
    if(el){
      const d = new Date();
      el.textContent = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }
  };
  setActive();
  tick();
  setInterval(tick, 1000);
})();
