# Tornado Shawarma — Animated Digital Menu

Cinematic, full-screen, looping digital menu built on the **approved menu artwork**
(`page1_full.png`, `page2_full.png`, `page3_full.png`) and the exact crops described in
`assets/manifest.json`. No text is re-typed, no image is regenerated, nothing is redrawn —
the PNGs are the visual source of truth.

Plain HTML / CSS / JS + GSAP (vendored). No build step.

## Run

```bash
npm install
npm run dev        # -> http://localhost:5173
```

The page also works by simply opening `index.html` in a browser (a bundled copy of the manifest
is used when `fetch()` is not available on `file://`). For a restaurant screen, open the URL in
Chrome/Edge and press **F** (or double-click) for fullscreen; the cursor hides by itself.

## Two artwork sets (chosen automatically from the screen shape)

| Screen | Set | What is shown |
|---|---|---|
| TV / desktop / laptop / tablet held sideways (aspect ≥ 1.2) | **landscape** | 6 slides (one menu section each) that fill a 16:9 screen edge to edge, text ~2× bigger than the portrait page would be on the same screen |
| phone / tablet held upright | **portrait** | the 3 approved pages as they are |

The landscape slides in `assets/landscape/` are **not a redesign**: `tools/make_landscape.py` composes
them purely from exact pixel crops of the approved pages (logo/title block, food photo, section text
with prices, footer bar), scaled with Lanczos and placed on a background made from an empty texture
patch of the same artwork (luminance-matched under every piece so no seams show). Regenerate with
`python tools/make_landscape.py` (needs Pillow + numpy) after changing the portrait pages.
Force a set with `?set=portrait` or `?set=landscape`.

## How it works

Every page is a stack:

```
.page
  img.page__full     untouched full-page PNG  (what customers see during the hold)
  img.page__blur     soft-focus copy of the same PNG (entrance only)
  .page__shade       dark veil (entrance only)
  .page__layers      exact crops, positioned with manifest percentages, animated by GSAP
```

1. Page slides in (cinematic horizontal slide, `cubic-bezier(0.22,1,0.36,1)`, ~1s, subtle motion blur).
2. Crops animate into their exact manifest position (header ↓, food ← with soft warm glow, RTL text →, divider grows, footer ↑).
3. The veil lifts off the full PNG (~0.5s), then the crops fade out (~0.3s). Because the crops are
   pixel-identical to the page underneath, the crossfade is invisible — verified with a pixel diff
   (0 differing pixels inside the artwork on all three pages).
4. Only `pageX_full.png` is on screen for the hold (~4s). Only allowed micro-motion: an imperceptible
   whole-page 1 → 1.005 breathe and a slow ambient light pulse *behind* the artwork.
5. Loop: 1 → 2 → 3 → 1 …

`prefers-reduced-motion`: pages simply crossfade, nothing else moves.

## Controls

| Input | Action |
|---|---|
| ← / → , PageUp / PageDown, Space, 1-3 | previous / next / jump |
| Swipe (touch) or drag (mouse) | previous / next |
| Dots at the bottom | jump |
| **F** or double-click | toggle fullscreen |

After any user input autoplay pauses for 10 s, then resumes.

## Fullscreen

Browsers do not allow a page to go fullscreen on its own (a user gesture is required), so:

* **First tap / click / key press anywhere enters fullscreen** automatically (a small
  "اضغط لملء الشاشة" pill is shown until then). If someone leaves fullscreen on purpose (Esc / F),
  the page stops re-entering by itself; the pill brings it back. Disable with `?fs=0` in the URL.
* **Install it as an app** (Chrome/Edge: address bar → "Install", Android: "Add to Home screen",
  iOS Safari: Share → "Add to Home Screen"). The included `manifest.webmanifest` uses
  `display: fullscreen`, so the installed app opens fullscreen with no gesture at all — the best
  option for a tablet on the counter.
* **Kiosk mode** for a Windows PC / TV stick that should boot straight into the menu:

  ```
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-infobars https://haitham-wj.github.io/menu/
  ```
  (put a shortcut with this command in the Startup folder). Edge: `msedge.exe --kiosk <url> --edge-kiosk-type=fullscreen`.

## Project structure

```
index.html
manifest.webmanifest       installable web app (opens fullscreen when installed)
css/style.css              layout, stage aspect ratio, feathered crops, background, controls
js/config.js               ALL timings, choreography per page, layer geometry tweaks
js/layers.js               builds page DOM from manifest.json
js/animations.js           GSAP timelines (entrance + reveal, page transitions)
js/controls.js             dots, keyboard, swipe/drag, fullscreen, idle cursor
js/background.js           ambient light pulse + dust particles (behind the artwork)
js/app.js                  boot: manifest -> preload -> build -> sequencer/autoplay
js/manifest-data.js        embedded copy of assets/manifest.json (file:// fallback)
vendor/gsap.min.js, vendor/CustomEase.min.js
assets/
  manifest.json
  page1_full.png  page2_full.png  page3_full.png
  page1/ page2/ page3/     the crops
  landscape/               16:9 slides l1..l6 + crops + manifest.json (generated)
  icons/                   app icons (from the brand logo)
tools/make_landscape.py    builds assets/landscape/ from the approved pages
scripts/embed-manifest.js  regenerates js/manifest-data.js (npm run manifest:embed)
```

## Tuning

Everything lives in `js/config.js`:

* `sets` (per-set `pageDuration`, page order, fill mode), `landscapeMinAspect`
* `transitionDuration`, `revealDuration`, `autoplayResumeDelay`
* `choreography.pageN[]` — order, delay (`at`), duration and start offsets of every crop
* `motionBlur`, `veilBlur`, `holdBreathe`, `particles`
* `layout` — layer geometry tweaks (see below)

CSS variables in `css/style.css`: `--shade` (veil darkness), `--veil-blur`, `--feather`.

### About `layout` (layer geometry tweaks)

The manifest crops are rectangles, and in a few spots one rectangle contains a sliver of a
*neighbouring* element (e.g. the bottom of the plate ring on page 2 sits inside the footer crop,
the section divider on page 3 sits inside two crops). If those crops moved independently, the shared
sliver would appear twice for a moment. `layout` therefore trims/extends a few layer boxes and adds
the dividers as their own layers. Any pixels a layer needs beyond its crop file are taken from the
untouched full-page PNG (`img.layer__fill`), so nothing is ever redrawn or approximated. All values
were measured on the approved PNGs.

## Changing the artwork

Replace the PNGs, update `assets/manifest.json`, then run `npm run manifest:embed`
(only needed for `file://` usage). If a crop's box changes, review the matching entry in
`CONFIG.layout` (or remove it to fall back to the manifest box).
