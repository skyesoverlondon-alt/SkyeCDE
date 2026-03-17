
(function(){
  function render(){
    const data = window.SKYESPACE_DATA;
    const state = window.SKYE_STATE.get();

    const feed = [...state.quickPosts, ...data.feed];
    document.querySelector('#home-feed').innerHTML = feed.map(item => `
      <article class="feed-item" data-searchable>
        <div class="meta"><span><strong>${item.author}</strong> · ${item.role || item.category || 'Member'}</span><span class="badge purple">${item.type || item.lane || 'Post'}</span></div>
        <h3>${item.title}</h3>
        <p>${item.text}</p>
        <div class="card-actions">
          <button class="btn btn-soft" data-toggle-save="${(item.title||'x').replace(/\W+/g,'-')}">${state.saves[(item.title||'x').replace(/\W+/g,'-')] ? 'Saved' : 'Save'}</button>
          <button class="btn btn-soft" data-open-composer>Respond</button>
        </div>
      </article>
    `).join('');

    document.querySelector('#home-listings').innerHTML = data.listings.slice(0,4).map(item => `
      <article class="listing" data-searchable>
        <div class="meta"><span>${item.category}</span><span>${item.district}</span></div>
        <h3>${item.title}</h3>
        <p>By ${item.seller}</p>
        <div class="listing-pricing"><strong>${item.price}</strong><span class="badge gold">${item.eta}</span></div>
      </article>
    `).join('');

    document.querySelector('#home-signals').innerHTML = [...state.quickSignals, ...data.signals].slice(0,4).map(item => `
      <article class="signal-item" data-searchable>
        <div class="meta"><span>${item.source}</span><span>${item.age}</span></div>
        <span class="signal-severity ${item.severity}">${item.severity}</span>
        <h3 style="margin-top:12px">${item.title}</h3>
        <p>${item.detail}</p>
      </article>
    `).join('');
  }
  render();
  window.addEventListener('skye:update', render);
})();
