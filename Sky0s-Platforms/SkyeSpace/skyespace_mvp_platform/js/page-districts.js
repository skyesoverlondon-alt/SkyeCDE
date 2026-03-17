
(function(){
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();

    document.querySelector('#district-grid').innerHTML = data.districts.map((d, i) => `
      <article class="district-card" data-searchable>
        <div class="meta"><span>${d.hotspot}</span><span>${d.active}</span></div>
        <h3>${d.name}</h3>
        <p>${d.vibe}</p>
        <div class="card-actions">
          <button class="btn btn-soft" data-join="district-${i}">${state.joins[`district-${i}`] ? 'Joined' : 'Join'}</button>
          <button class="btn btn-soft">Open district</button>
        </div>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
