/* ==========================================================================
   animations.js — GSAP timelines
     • entrance(page)  : component choreography -> pixel-perfect reveal of the full PNG
     • transition(a,b) : cinematic horizontal slide between complete pages
   ========================================================================== */
(function () {
  const NS = window.TornadoMenu;
  const C = NS.CONFIG;

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weakDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
                     (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const useBlur = C.motionBlur && !reduced && !weakDevice;

  if (window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('cine', C.cinematicEase);
  }
  const CINE = window.CustomEase ? 'cine' : 'expo.out';

  NS.reducedMotion = reduced;

  /** Scale factor: choreography offsets are authored at the artwork's native width. */
  function pxScale(page, stageEl) {
    const w = stageEl.getBoundingClientRect().width || page.width;
    return w / page.width;
  }

  /**
   * Build the entrance timeline for a page (paused). Play it when the page starts.
   * The timeline ends in the "hold" state: only the untouched full PNG is visible.
   */
  NS.buildEntrance = function buildEntrance(page, stageEl) {
    const tl = gsap.timeline({ paused: true });
    const s = pxScale(page, stageEl);
    const steps = C.choreography[page.key] || [];
    const allLayers = Object.values(page.layers).map((l) => l.el);
    const allGlows = Object.values(page.layers).map((l) => l.glow).filter(Boolean);
    const allInners = Object.values(page.layers).map((l) => l.inner);

    if (reduced) {
      // Reduced motion: no component animation, the full page is simply shown.
      tl.set(page.shade, { opacity: 0 }, 0);
      if (page.blur) tl.set(page.blur, { opacity: 0 }, 0);
      tl.set(allLayers, { opacity: 0 }, 0);
      return tl;
    }

    // Initial state: dark veil over the full page, every crop hidden.
    tl.set(page.shade, { opacity: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--shade')) || 0.8 }, 0);
    if (page.blur) tl.set(page.blur, { opacity: 1 }, 0);
    tl.set(allLayers, { opacity: 0, x: 0, y: 0, scale: 1, rotation: 0 }, 0);
    tl.set(allInners, { scale: 1 }, 0);
    if (allGlows.length) tl.set(allGlows, { opacity: 0, scale: 0.92 }, 0);

    let lastEnd = 0;

    steps.forEach((step) => {
      const layer = page.layers[step.layer];
      if (!layer) { console.warn('[TornadoMenu] unknown layer in choreography:', page.key, step.layer); return; }
      const el = layer.el;
      const at = step.at;
      const dur = step.dur;
      lastEnd = Math.max(lastEnd, at + dur);

      if (step.reveal === 'width') {
        // Divider: grows from its centre outwards.
        tl.fromTo(el,
          { opacity: 1, clipPath: 'inset(0% 50% 0% 50%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: dur, ease: step.ease || 'power2.inOut' },
          at);
        return;
      }

      const from = Object.assign({}, step.from || {});
      if (from.x != null) from.x = from.x * s;
      if (from.y != null) from.y = from.y * s;
      if (from.opacity == null) from.opacity = 0;

      tl.fromTo(el, from,
        { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, duration: dur, ease: step.ease || 'power3.out' },
        at);

      // Subtle parallax: inner content zooms out slightly slower than the frame moves in.
      if (step.parallax && step.parallax !== 1) {
        tl.fromTo(layer.inner, { scale: step.parallax },
          { scale: 1, duration: dur * 1.3, ease: 'power2.out' }, at);
        lastEnd = Math.max(lastEnd, at + dur * 1.3);
      }

      // Warm glow behind hero food.
      if (step.glow && layer.glow) {
        tl.fromTo(layer.glow, { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: dur + 0.4, ease: 'power2.out' }, at);
      }
    });

    // ---- Reveal: lift the veil, then fade the (now pixel-identical) crops away ----
    const revealAt = lastEnd + 0.1;
    tl.to(page.shade, { opacity: 0, duration: C.revealDuration, ease: 'power2.inOut' }, revealAt);
    if (page.blur) tl.to(page.blur, { opacity: 0, duration: C.revealDuration, ease: 'power2.inOut' }, revealAt);
    if (allGlows.length) tl.to(allGlows, { opacity: 0, duration: C.revealDuration, ease: 'power2.inOut' }, revealAt);
    tl.to(allLayers, { opacity: 0, duration: C.layersFadeDuration, ease: 'power1.inOut' }, revealAt + C.revealDuration);
    tl.addLabel('hold', revealAt + C.revealDuration + C.layersFadeDuration);

    // ---- Hold: imperceptible breathe on the whole page (design itself untouched) ----
    if (C.holdBreathe) {
      const holdStart = revealAt + C.revealDuration + C.layersFadeDuration;
      const holdLen = Math.max(1, C.pageDuration - holdStart);
      tl.to(page.el, { scale: C.holdBreatheScale, duration: holdLen, ease: 'sine.inOut' }, holdStart);
    }

    return tl;
  };

  /**
   * Cinematic slide from `from` page to `to` page. dir = +1 (forward) / -1 (backward).
   * Returns the timeline (already playing).
   */
  NS.buildTransition = function buildTransition(from, to, dir) {
    dir = dir || 1;
    const D = reduced ? C.reducedMotionFade : C.transitionDuration;
    const tl = gsap.timeline();

    to.el.classList.add('is-active');
    to.el.style.zIndex = 2;
    if (from) from.el.style.zIndex = 1;

    if (reduced) {
      tl.fromTo(to.el, { opacity: 0 }, { opacity: 1, duration: D, ease: 'power1.inOut' }, 0);
      if (from) tl.to(from.el, { opacity: 0, duration: D, ease: 'power1.inOut' }, 0);
    } else {
      tl.fromTo(to.el,
        { xPercent: 10 * dir, scale: 0.97, opacity: 0 },
        { xPercent: 0, scale: 1, opacity: 1, duration: D, ease: CINE }, 0);

      if (from) {
        tl.to(from.el,
          { xPercent: -7 * dir, scale: 0.97, opacity: 0, duration: D, ease: CINE }, 0);
      }

      if (useBlur) {
        const targets = from ? [to.el, from.el] : [to.el];
        tl.fromTo(targets, { filter: 'blur(0px)' },
          { filter: 'blur(' + C.motionBlurMax + 'px)', duration: D * 0.35, ease: 'sine.in' }, 0);
        tl.to(targets, { filter: 'blur(0px)', duration: D * 0.65, ease: 'sine.out' }, D * 0.35);
        tl.set(targets, { clearProps: 'filter' });
      }
    }

    if (from) {
      tl.call(() => {
        from.el.classList.remove('is-active');
        gsap.set(from.el, { xPercent: 0, scale: 1, opacity: 0, clearProps: 'filter' });
      }, null, D);
    }
    return tl;
  };

  /** Instantly hide a page (used when the user skips mid-transition). */
  NS.hidePageNow = function hidePageNow(page) {
    gsap.killTweensOf(page.el);
    gsap.to(page.el, {
      opacity: 0, duration: 0.25, ease: 'power1.out', overwrite: 'auto',
      onComplete() {
        page.el.classList.remove('is-active');
        gsap.set(page.el, { xPercent: 0, scale: 1, clearProps: 'filter' });
      },
    });
  };
})();
