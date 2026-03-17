
(function(){
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();
    const items = [...state.quickListings, ...data.listings];
    document.querySelector('#market-listings').innerHTML = items.map((item, i) => `
      <article class="listing" data-searchable>
        <div class="meta"><span>${item.category}</span><span>${item.district}</span></div>
        <h3>${item.title}</h3>
        <p>${item.seller}</p>
        <div class="listing-pricing"><strong>${item.price}</strong><span class="badge blue">${item.eta}</span></div>
        <div class="card-actions">
          <button class="btn btn-soft" data-toggle-save="listing-${i}">${state.saves[`listing-${i}`] ? 'Saved' : 'Save'}</button>
          <button class="btn btn-gold">Book / Buy</button>
        </div>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
