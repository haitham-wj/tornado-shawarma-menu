/* ==========================================================================
   Tornado Shawarma — configuration
   All timings in seconds. Everything about the sequence lives here.
   ========================================================================== */
window.TornadoMenu = window.TornadoMenu || {};

TornadoMenu.CONFIG = {
  manifestUrl: 'assets/manifest.json',
  assetsBase: 'assets/',

  // Order in which the pages loop
  pageOrder: ['page1', 'page2', 'page3'],

  // ---- Timing --------------------------------------------------------------
  pageDuration: 7.0,        // start of one page -> start of the next (entrance + hold)
  transitionDuration: 1.05, // cinematic horizontal slide between complete pages
  revealDuration: 0.5,      // dark veil lifting off the untouched full page
  layersFadeDuration: 0.3,  // animated crops fading out on top of the full page
  reducedMotionHold: 6.0,   // seconds per page when prefers-reduced-motion is on
  reducedMotionFade: 0.7,
  autoplayResumeDelay: 10,  // seconds of silence after user input before autoplay resumes

  // ---- Fullscreen ----------------------------------------------------------
  // Browsers refuse fullscreen without a user gesture, so "auto" means: the FIRST tap / click / key
  // press anywhere enters fullscreen (a small hint is shown until then). Disable with ?fs=0 in the URL.
  // For a truly automatic fullscreen use kiosk mode or install the page as an app (see README).
  autoFullscreen: true,

  // ---- Feel ----------------------------------------------------------------
  cinematicEase: '0.22, 1, 0.36, 1',    // cubic-bezier used for page transitions
  motionBlur: true,                     // subtle CSS blur while pages slide (auto-off on weak devices)
  motionBlurMax: 2.2,                   // px
  veilBlur: true,                       // soft-focus copy of the page under the dark veil during entrances
  holdBreathe: true,                    // imperceptible 1 -> 1.005 scale during the hold
  holdBreatheScale: 1.005,
  particles: true,                      // tiny slow dust behind the artwork
  particleCount: 42,
  featherRatio: 0.0125,                 // soft crop edge as a fraction of stage width

  // ---- Per-page entrance choreography -------------------------------------
  // Each step: { layer, at (seconds from page start), dur, from: {...gsap vars}, ease }
  // 'from' values are the START state; every layer always ends at its exact manifest position.
  // x/y are in px at a 1122px-wide stage and are scaled to the rendered size at runtime.
  choreography: {
    page1: [
      { layer: 'header',        at: 0.20, dur: 0.70, from: { y: -25, opacity: 0 }, ease: 'power2.out' },
      { layer: 'shawarma_food', at: 0.60, dur: 0.95, from: { x: -80, scale: 0.92, opacity: 0 }, ease: 'back.out(1.35)', glow: true },
      { layer: 'shawarma_text', at: 1.00, dur: 0.80, from: { x: 50, opacity: 0 }, ease: 'power3.out' },
      { layer: 'arabic_food',   at: 1.40, dur: 0.90, from: { x: -34, y: 50, scale: 0.94, opacity: 0 }, ease: 'power3.out' },
      { layer: 'arabic_text',   at: 1.80, dur: 0.80, from: { x: 50, opacity: 0 }, ease: 'power3.out' },
      { layer: 'footer',        at: 2.10, dur: 0.60, from: { y: 20, opacity: 0 }, ease: 'power2.out' },
    ],
    page2: [
      { layer: 'header',              at: 0.20, dur: 0.70, from: { y: -25, opacity: 0 }, ease: 'power2.out' },
      { layer: 'bashka_food',         at: 0.60, dur: 1.05, from: { x: -70, scale: 0.90, opacity: 0 }, ease: 'power3.out', glow: true, parallax: 1.06 },
      { layer: 'bashka_text',         at: 1.00, dur: 0.80, from: { x: 50, opacity: 0 }, ease: 'power3.out' },
      { layer: 'divider',             at: 1.30, dur: 0.75, reveal: 'width', ease: 'power2.inOut' },
      { layer: 'shawarma_plate_food', at: 1.50, dur: 0.95, from: { x: -30, y: 50, scale: 0.90, rotation: -1, opacity: 0 }, ease: 'power3.out' },
      { layer: 'shawarma_plate_text', at: 1.90, dur: 0.80, from: { x: 50, opacity: 0 }, ease: 'power3.out' },
      { layer: 'footer',              at: 2.20, dur: 0.60, from: { y: 20, opacity: 0 }, ease: 'power2.out' },
    ],
    page3: [
      { layer: 'header',      at: 0.20, dur: 0.70, from: { y: -25, opacity: 0 }, ease: 'power2.out' },
      { layer: 'burger_food', at: 0.60, dur: 1.10, from: { x: -70, scale: 0.82, opacity: 0 }, ease: 'power3.out', glow: true },
      { layer: 'burger_text', at: 1.00, dur: 0.80, from: { x: 50, opacity: 0 }, ease: 'power3.out' },
      { layer: 'divider',     at: 1.30, dur: 0.75, reveal: 'width', ease: 'power2.inOut' },
      { layer: 'extras_food', at: 1.50, dur: 0.95, from: { x: -34, y: 50, scale: 0.94, opacity: 0 }, ease: 'power3.out' },
      { layer: 'extras_text', at: 1.90, dur: 0.80, from: { x: 50, opacity: 0 }, ease: 'power3.out' },
      { layer: 'footer',      at: 2.20, dur: 0.60, from: { y: 20, opacity: 0 }, ease: 'power2.out' },
    ],
  },

  // ---- Layer geometry tweaks (page pixels, [x0, y0, x1, y1]) --------------
  // The manifest crops are rectangles that in a few places overlap the *neighbouring* artwork
  // (e.g. the plate ring on page 2 continues into the footer crop, the divider on page 3 sits
  // inside two crops). If those crops moved independently the shared slivers would "ghost".
  //
  // `box`  : final rectangle a layer occupies. Anything outside the manifest crop is filled with
  //          the exact same pixels taken from the untouched full-page PNG (never redrawn).
  // `cut`  : polygon (page px) that limits the visible region of the layer.
  // `sprite`: layer that has no crop file — it is a rectangle of the full-page PNG.
  // Every value below was measured on the approved PNGs; nothing is regenerated.
  layout: {
    page1: {
      header:        { box: [220, 15, 900, 440], cut: [[220, 15], [900, 15], [900, 440], [548, 440], [548, 393], [220, 393]] },
      shawarma_food: { box: [0, 393, 548, 882] },
      arabic_food:   { box: [0, 882, 520, 1312] },
      footer:        { box: [25, 1314, 1075, 1385] },
    },
    page2: {
      header:              { box: [220, 15, 900, 390] },
      bashka_food:         { box: [0, 385, 620, 812] },
      divider:             { sprite: true, box: [60, 808, 1060, 842], after: 'bashka_text' },
      shawarma_plate_food: { box: [0, 842, 610, 1240] },
      footer:              { box: [25, 1241, 1070, 1325] },
    },
    page3: {
      header:      { box: [220, 15, 900, 432], cut: [[220, 15], [900, 15], [900, 432], [395, 432], [395, 393], [220, 393]] },
      burger_food: { box: [0, 393, 522, 874], cut: [[0, 393], [395, 393], [395, 432], [522, 432], [522, 874], [0, 874]] },
      divider:     { sprite: true, box: [60, 875, 1060, 900], after: 'burger_text' },
      extras_food: { box: [0, 900, 590, 1266] },
      extras_text: { box: [590, 900, 1085, 1215] },
      footer:      { box: [25, 1268, 1070, 1345] },
    },
  },
};
