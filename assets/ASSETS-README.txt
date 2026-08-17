TORNADO SHAWARMA — WEB ANIMATION ASSETS

Contents
- page1_full.png / page2_full.png / page3_full.png: the three approved menu pages.
- page1/, page2/, page3/: exact rectangular crops from each page.
- manifest.json: pixel and percentage coordinates for every crop.

Important implementation idea
Use the full page as the visual source of truth. For animated sequences, temporarily show the
cropped layer at its original position while the corresponding area of the base page is hidden
with a CSS mask/clip-path. This guarantees that the menu never visually changes.

Recommended order per page
1. Header/logo/title: soft fade + slight vertical movement.
2. Main food photo: scale 0.92 -> 1 + gentle rotation/overshoot.
3. Main text block: slide from the right (RTL).
4. Secondary food photo: slide from the left.
5. Secondary text block: slide from the right.
6. Footer: rise 16-24px from the bottom.
7. Hold the complete static page for ~4 seconds.
8. Transition to the next page with a horizontal cinematic slide.

Do not OCR/rebuild Arabic text. Animate image crops instead.
