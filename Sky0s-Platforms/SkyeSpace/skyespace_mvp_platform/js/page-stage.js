
(function(){
  const data = window.SKYESPACE_DATA;
  document.querySelector('#creator-rail').innerHTML = data.creators.map(c => `
    <article class="creator-card" data-searchable>
      <div class="meta"><span>${c.followers}</span><span>${c.revenue}</span></div>
      <h3>${c.name}</h3>
      <p>${c.tag}</p>
      <div class="card-actions"><button class="btn btn-purple">Follow</button><button class="btn btn-soft">Open stage</button></div>
    </article>
  `).join('');
})();
