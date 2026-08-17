/* ==========================================================================
   background.js — ambient light pulse + slow dust particles.
   Everything here lives BEHIND the artwork (z-index 0). Nothing touches the menu.
   ========================================================================== */
(function () {
  const NS = window.TornadoMenu;
  const C = NS.CONFIG;

  NS.startBackground = function startBackground() {
    const reduced = NS.reducedMotion;
    const ambient = document.querySelector('.bg__ambient');
    const canvas = document.querySelector('.bg__dust');

    // Very slow warm pulse (never flashing)
    if (ambient && !reduced) {
      gsap.to(ambient, { opacity: 0.95, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }

    if (!canvas || !C.particles || reduced) {
      if (canvas) canvas.remove();
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let last = performance.now();
    let running = true;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(p, initial) {
      p.x = Math.random() * w;
      p.y = initial ? Math.random() * h : h + 10;
      p.r = 0.6 + Math.random() * 1.4;
      p.vy = -(4 + Math.random() * 9);          // px per second, drifting up
      p.vx = (Math.random() - 0.5) * 6;
      p.a = 0.08 + Math.random() * 0.22;
      p.phase = Math.random() * Math.PI * 2;
      p.warm = Math.random() < 0.35;
      return p;
    }

    function init() {
      particles = [];
      for (let i = 0; i < C.particleCount; i++) particles.push(spawn({}, true));
    }

    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += (p.vx + Math.sin(now / 2500 + p.phase) * 3) * dt;
        p.y += p.vy * dt;
        if (p.y < -10 || p.x < -10 || p.x > w + 10) spawn(p, false);
        const tw = 0.7 + 0.3 * Math.sin(now / 1400 + p.phase);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.warm
          ? 'rgba(255, 150, 90,' + (p.a * tw) + ')'
          : 'rgba(255, 235, 220,' + (p.a * tw * 0.8) + ')';
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    resize();
    init();
    window.addEventListener('resize', () => { resize(); init(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { running = false; }
      else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    });
    requestAnimationFrame(frame);
  };
})();
