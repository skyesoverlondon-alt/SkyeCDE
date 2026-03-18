(function(){
  const cfg = window.__SKYE_BG__ || {};
  const mount = document.getElementById('bg-mount');
  if(!mount) return;
  mount.innerHTML = '<canvas id="skye-bg-canvas"></canvas><div class="bg-noise"></div><div class="bg-vignette"></div>';
  const canvas = document.getElementById('skye-bg-canvas');
  const ctx = canvas.getContext('2d');
  let w=0,h=0,dpr=Math.min(window.devicePixelRatio||1,2), t=0;
  const particles = Array.from({length: cfg.count || 120}, (_,i)=>({
    x: Math.random(), y: Math.random(), z: Math.random()*0.9+0.1,
    r: Math.random()*1.8+0.4, vx:(Math.random()-.5)*0.0007, vy:(Math.random()-.5)*0.0007
  }));
  function resize(){
    w=canvas.width=Math.floor(innerWidth*dpr); h=canvas.height=Math.floor(innerHeight*dpr);
    canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px';
  }
  function hexToRgb(hex){
    const m = hex.replace('#','');
    const num = parseInt(m,16);
    return [num>>16 & 255, num>>8 & 255, num & 255];
  }
  const c1 = hexToRgb(cfg.c1 || '#8b5cf6');
  const c2 = hexToRgb(cfg.c2 || '#27f2ff');
  const c3 = hexToRgb(cfg.c3 || '#ffd36a');
  function draw(){
    t += 0.008;
    const grad = ctx.createRadialGradient(w*0.5,h*0.45,w*0.08,w*0.5,h*0.5,Math.max(w,h)*0.75);
    grad.addColorStop(0, cfg.base1 || '#0b0717');
    grad.addColorStop(0.45, cfg.base2 || '#090e1d');
    grad.addColorStop(1, cfg.base3 || '#030306');
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

    for(let i=0;i<3;i++){
      const px = (0.2 + i*0.3 + Math.sin(t*0.5+i)*0.06) * w;
      const py = (0.3 + Math.cos(t*0.7+i)*0.12) * h;
      const rg = ctx.createRadialGradient(px,py,0,px,py,Math.max(w,h)*0.22);
      const col = i===0?c1:i===1?c2:c3;
      rg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.23)`);
      rg.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.fillStyle = rg; ctx.fillRect(0,0,w,h);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    particles.forEach((p, idx)=>{
      p.x += p.vx * p.z * (cfg.speed || 1);
      p.y += p.vy * p.z * (cfg.speed || 1);
      if(p.x<0||p.x>1) p.vx *= -1;
      if(p.y<0||p.y>1) p.vy *= -1;
      const x = p.x*w, y = p.y*h + Math.sin(t*2 + idx*0.08)*14*dpr;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${c2[0]},${c2[1]},${c2[2]},${0.05+p.z*0.35})`;
      ctx.arc(x,y,p.r*dpr*(0.8+Math.sin(t+idx)*0.15),0,Math.PI*2); ctx.fill();
    });
    ctx.restore();

    ctx.strokeStyle = `rgba(${c3[0]},${c3[1]},${c3[2]},0.08)`;
    ctx.lineWidth = 1*dpr;
    for(let i=0;i<7;i++){
      const y = ((i+1)/8)*h + Math.sin(t+i)*12*dpr;
      ctx.beginPath();
      for(let x=0;x<=w;x+=12*dpr){
        const yy = y + Math.sin(t*2 + x*0.002 + i)*6*dpr;
        if(x===0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }
  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(draw);
})();