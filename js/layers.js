/* ==========================================================================
   layers.js — builds the DOM for one menu page from manifest.json
   Structure per page:
     .page
       img.page__full      untouched approved artwork (source of truth)
       .page__shade        dark veil during the entrance sequence
       .page__layers
         .glow             (only behind hero food)
         .layer            one exact crop, positioned by manifest percentages
           .layer__inner
             img.layer__fill   (only when the layer box extends past its crop: same pixels from the full PNG)
             img.layer__img    the crop file from the manifest
   ========================================================================== */
(function () {
  const NS = window.TornadoMenu;
  const pct = (v) => (Math.round(v * 10000) / 10000) + '%';

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  /**
   * Resolve the ordered layer list for a page: manifest layers in manifest order,
   * plus any sprite-only layers from CONFIG.layout inserted after their `after` target.
   */
  function resolveLayerList(pageKey, pageData) {
    const tweaks = (NS.CONFIG.layout[pageKey]) || {};
    const list = Object.keys(pageData.layers).map((key) => ({
      key,
      file: pageData.layers[key].file,
      crop: pageData.layers[key].box_px.slice(),
      tweak: tweaks[key] || null,
    }));

    Object.keys(tweaks).forEach((key) => {
      const t = tweaks[key];
      if (!t.sprite) return;
      const item = { key, file: null, crop: null, tweak: t };
      const idx = t.after ? list.findIndex((l) => l.key === t.after) : -1;
      if (idx >= 0) list.splice(idx + 1, 0, item); else list.push(item);
    });
    return list;
  }

  /**
   * Build one page. Returns a descriptor used by animations.js.
   */
  NS.buildPage = function buildPage(pageKey, pageData, index) {
    const base = NS.CONFIG.assetsBase;
    const W = pageData.width;
    const H = pageData.height;
    const fullSrc = base + pageData.full;
    const chor = NS.CONFIG.choreography[pageKey] || [];
    const glowFor = new Set(chor.filter((s) => s.glow).map((s) => s.layer));

    const page = el('section', 'page');
    page.dataset.page = pageKey;
    page.setAttribute('aria-label', 'Menu page ' + (index + 1));
    page.setAttribute('aria-roledescription', 'slide');

    const full = el('img', 'page__full', page);
    full.src = fullSrc;
    full.alt = 'Tornado Shawarma menu — page ' + (index + 1);
    full.decoding = 'async';
    full.draggable = false;

    // Optional soft-focus veil: a blurred copy of the same PNG (static CSS filter) under the dark shade,
    // so nothing under the veil is readable while the sharp crops animate in.
    let blur = null;
    if (NS.CONFIG.veilBlur) {
      blur = el('img', 'page__blur', page);
      blur.src = fullSrc;
      blur.alt = '';
      blur.decoding = 'async';
      blur.draggable = false;
    }

    const shade = el('div', 'page__shade', page);
    const layersWrap = el('div', 'page__layers', page);

    const layers = {};

    resolveLayerList(pageKey, pageData).forEach((item) => {
      const box = (item.tweak && item.tweak.box) ? item.tweak.box : item.crop;
      const [bx0, by0, bx1, by1] = box;
      const bw = bx1 - bx0;
      const bh = by1 - by0;

      // Optional warm glow behind hero food (behind the crop, so it never covers artwork)
      let glow = null;
      if (glowFor.has(item.key)) {
        glow = el('div', 'glow', layersWrap);
        const gx = bw * 0.14, gy = bh * 0.14;
        Object.assign(glow.style, {
          left: pct((bx0 - gx) / W * 100),
          top: pct((by0 - gy) / H * 100),
          width: pct((bw + 2 * gx) / W * 100),
          height: pct((bh + 2 * gy) / H * 100),
        });
      }

      const layer = el('div', 'layer', layersWrap);
      layer.dataset.layer = item.key;
      Object.assign(layer.style, {
        left: pct(bx0 / W * 100),
        top: pct(by0 / H * 100),
        width: pct(bw / W * 100),
        height: pct(bh / H * 100),
      });

      if (item.tweak && item.tweak.cut) {
        const pts = item.tweak.cut.map(([px, py]) =>
          pct((px - bx0) / bw * 100) + ' ' + pct((py - by0) / bh * 100));
        layer.style.clipPath = 'polygon(' + pts.join(', ') + ')';
        layer.style.webkitClipPath = layer.style.clipPath;
      }

      const inner = el('div', 'layer__inner', layer);

      // Does the layer box extend beyond the crop file? Then fill from the full PNG (same pixels).
      const needsFill = !item.crop ||
        bx0 < item.crop[0] || by0 < item.crop[1] || bx1 > item.crop[2] || by1 > item.crop[3];

      if (needsFill) {
        const fill = el('img', 'layer__fill', inner);
        fill.src = fullSrc;
        fill.alt = '';
        fill.draggable = false;
        fill.decoding = 'async';
        Object.assign(fill.style, {
          left: pct(-bx0 / bw * 100),
          top: pct(-by0 / bh * 100),
          width: pct(W / bw * 100),
          height: pct(H / bh * 100),
        });
      }

      if (item.file) {
        const img = el('img', 'layer__img', inner);
        img.src = base + item.file;
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        const [cx0, cy0, cx1, cy1] = item.crop;
        Object.assign(img.style, {
          left: pct((cx0 - bx0) / bw * 100),
          top: pct((cy0 - by0) / bh * 100),
          width: pct((cx1 - cx0) / bw * 100),
          height: pct((cy1 - cy0) / bh * 100),
        });
      }

      layers[item.key] = { key: item.key, el: layer, inner, glow, box };
    });

    return { key: pageKey, index, el: page, full, blur, shade, layersWrap, layers, width: W, height: H };
  };

  /** Collect every image URL a page needs (for preloading). */
  NS.pageImageUrls = function pageImageUrls(pageData) {
    const base = NS.CONFIG.assetsBase;
    const urls = [base + pageData.full];
    Object.keys(pageData.layers).forEach((k) => urls.push(base + pageData.layers[k].file));
    return urls;
  };
})();
