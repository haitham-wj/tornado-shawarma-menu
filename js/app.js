/* ==========================================================================
   app.js — boot: load manifest -> preload every PNG -> build pages -> run sequencer
   ========================================================================== */
(function () {
  const NS = window.TornadoMenu;
  const C = NS.CONFIG;

  // ---- Artwork set (portrait pages vs landscape slides) ------------------------
  function pickSetName() {
    const forced = new URLSearchParams(location.search).get('set');
    if (forced && C.sets[forced]) return forced;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    return aspect >= C.landscapeMinAspect && C.sets.landscape ? 'landscape' : 'portrait';
  }

  // ---- Manifest ---------------------------------------------------------------
  async function loadManifest(setName) {
    const set = C.sets[setName];
    try {
      const res = await fetch(set.manifestUrl, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      // file:// or offline: fall back to the embedded copies (js/manifest-data.js)
      const emb = window.TORNADO_MANIFESTS && window.TORNADO_MANIFESTS[setName];
      if (emb) return emb;
      throw err;
    }
  }

  // ---- Preload ------------------------------------------------------------------
  function preload(urls, onProgress) {
    let done = 0;
    const unique = Array.from(new Set(urls));
    return Promise.all(unique.map((src) => new Promise((resolve) => {
      const img = new Image();
      const finish = () => {
        done++;
        onProgress && onProgress(done / unique.length);
        resolve(img);
      };
      img.onload = () => {
        if (img.decode) img.decode().then(finish, finish); else finish();
      };
      img.onerror = () => { console.warn('[TornadoMenu] failed to load', src); finish(); };
      img.src = src;
    })));
  }

  // ---- Sequencer ------------------------------------------------------------------
  function createSequencer(pages, stageEl) {
    let current = -1;
    let entranceTl = null;
    let transitionTl = null;
    let autoTimer = null;
    let lastUserAt = -Infinity;
    const listeners = [];

    function scheduleNext(userTriggered) {
      if (autoTimer) autoTimer.kill();
      let delay = NS.reducedMotion ? C.reducedMotionHold : (NS.activeSet ? NS.activeSet.pageDuration : C.pageDuration);
      if (userTriggered) delay = Math.max(delay, C.autoplayResumeDelay);
      autoTimer = gsap.delayedCall(delay, () => goTo((current + 1) % pages.length, { dir: 1 }));
    }

    function goTo(index, opts) {
      opts = opts || {};
      index = ((index % pages.length) + pages.length) % pages.length;
      if (index === current) {
        // Re-selecting the current page: just restart its entrance.
        if (opts.user || opts.force) restartCurrent();
        return;
      }
      const dir = opts.dir != null ? opts.dir : (index > current ? 1 : -1);
      const from = current >= 0 ? pages[current] : null;
      const to = pages[index];

      // Stop whatever is running
      if (entranceTl) entranceTl.kill();
      if (transitionTl) transitionTl.kill();
      pages.forEach((p, i) => {
        if (i !== index && i !== current && p.el.classList.contains('is-active')) NS.hidePageNow(p);
      });

      current = index;
      transitionTl = NS.buildTransition(from, to, dir);
      entranceTl = NS.buildEntrance(to, stageEl);
      entranceTl.play(0);

      if (opts.user) lastUserAt = performance.now();
      scheduleNext(!!opts.user);
      listeners.forEach((fn) => fn(index));
    }

    function restartCurrent() {
      const page = pages[current];
      if (entranceTl) entranceTl.kill();
      gsap.set(page.el, { scale: 1 });
      entranceTl = NS.buildEntrance(page, stageEl);
      entranceTl.play(0);
      lastUserAt = performance.now();
      scheduleNext(true);
    }

    return {
      goTo,
      next: (o) => goTo(current + 1, Object.assign({ dir: 1 }, o)),
      prev: (o) => goTo(current - 1, Object.assign({ dir: -1 }, o)),
      onChange: (fn) => listeners.push(fn),
      get current() { return current; },
    };
  }

  // ---- Boot -----------------------------------------------------------------------
  async function boot() {
    const stageEl = document.getElementById('stage');
    const loader = document.getElementById('loader');
    const loaderFill = document.getElementById('loaderFill');

    const setName = pickSetName();
    const set = Object.assign({ name: setName }, C.sets[setName]);
    NS.activeSet = set;
    document.body.dataset.set = setName;
    if (set.fill) stageEl.classList.add('stage--fill');

    let manifest;
    try {
      manifest = await loadManifest(setName);
    } catch (err) {
      console.error('[TornadoMenu] could not load manifest', set.manifestUrl, err);
      loader.innerHTML = '<p style="opacity:.6;font-size:14px">Could not load ' + set.manifestUrl + '</p>';
      return;
    }

    // If the screen shape changes enough to need the other set (e.g. a tablet rotated), reload.
    window.addEventListener('resize', () => {
      if (pickSetName() === setName) return;
      clearTimeout(window.__tmReloadT);
      window.__tmReloadT = setTimeout(() => { if (pickSetName() !== setName) location.reload(); }, 600);
    });

    const order = set.pageOrder.filter((k) => manifest.pages[k]);
    if (!order.length) { console.error('[TornadoMenu] no pages in manifest'); return; }

    // Stage aspect ratio from the artwork itself
    const first = manifest.pages[order[0]];
    document.documentElement.style.setProperty('--stage-ar', first.width + ' / ' + first.height);

    // Feather width follows the rendered stage size
    const updateFeather = () => {
      const w = stageEl.getBoundingClientRect().width;
      document.documentElement.style.setProperty('--feather', (w * C.featherRatio).toFixed(2) + 'px');
    };
    updateFeather();
    window.addEventListener('resize', updateFeather);

    // Preload every PNG (full pages + crops) before anything moves
    const urls = order.flatMap((k) => NS.pageImageUrls(manifest.pages[k]));
    await preload(urls, (p) => { loaderFill.style.width = Math.round(p * 100) + '%'; });

    // Build pages
    const pages = order.map((k, i) => {
      const page = NS.buildPage(k, manifest.pages[k], i);
      stageEl.appendChild(page.el);
      return page;
    });

    const sequencer = createSequencer(pages, stageEl);
    NS.setupControls(sequencer, pages.length);
    NS.startBackground();

    // Let the loader fade, then start
    loader.classList.add('is-hidden');
    setTimeout(() => loader.remove(), 800);
    updateFeather();
    sequencer.goTo(0, { dir: 1 });

    // Expose for debugging / signage integrations
    NS.sequencer = sequencer;
    NS.pages = pages;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
