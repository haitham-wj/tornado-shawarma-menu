/* ==========================================================================
   controls.js — minimal user controls
     • dots (● ○ ○), keyboard arrows, touch swipe, mouse drag
     • double-click / "F" toggles fullscreen (handy on signage screens)
     • cursor auto-hides after inactivity
   All navigation goes through the sequencer's goTo(index, {user:true}).
   ========================================================================== */
(function () {
  const NS = window.TornadoMenu;

  NS.setupControls = function setupControls(sequencer, pageCount) {
    const dotsEl = document.getElementById('dots');
    const viewer = document.getElementById('viewer');
    const dots = [];

    // ---- Dots ---------------------------------------------------------------
    for (let i = 0; i < pageCount; i++) {
      const b = document.createElement('button');
      b.className = 'dot';
      b.type = 'button';
      b.setAttribute('aria-label', 'Page ' + (i + 1));
      b.addEventListener('click', () => sequencer.goTo(i, { user: true }));
      dotsEl.appendChild(b);
      dots.push(b);
    }
    sequencer.onChange((index) => {
      dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
    });

    // ---- Keyboard -------------------------------------------------------------
    window.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault(); sequencer.next({ user: true }); break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault(); sequencer.prev({ user: true }); break;
        case 'Home':
          e.preventDefault(); sequencer.goTo(0, { user: true }); break;
        case 'End':
          e.preventDefault(); sequencer.goTo(pageCount - 1, { user: true }); break;
        case 'f':
        case 'F':
          toggleFullscreen(); break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const n = parseInt(e.key, 10) - 1;
            if (n < pageCount) sequencer.goTo(n, { user: true });
          }
      }
    });

    // ---- Swipe / drag ---------------------------------------------------------
    let startX = 0, startY = 0, startT = 0, tracking = false, pointerId = null;
    const THRESHOLD = 40;   // px
    const MAX_TIME = 900;   // ms

    viewer.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      tracking = true;
      pointerId = e.pointerId;
      startX = e.clientX; startY = e.clientY; startT = performance.now();
    });

    function endSwipe(e) {
      if (!tracking || e.pointerId !== pointerId) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dt = performance.now() - startT;
      if (dt > MAX_TIME) return;
      if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      // Content slides left when going forward, so a leftward swipe = next.
      if (dx < 0) sequencer.next({ user: true }); else sequencer.prev({ user: true });
    }
    viewer.addEventListener('pointerup', endSwipe);
    viewer.addEventListener('pointercancel', () => { tracking = false; });

    // ---- Fullscreen -----------------------------------------------------------
    function toggleFullscreen() {
      const doc = document;
      const el = doc.documentElement;
      if (!doc.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
    }
    viewer.addEventListener('dblclick', toggleFullscreen);

    // ---- Idle cursor ----------------------------------------------------------
    let idleTimer = null;
    function wake() {
      document.body.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => document.body.classList.add('is-idle'), 3500);
    }
    ['pointermove', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    wake();
  };
})();
