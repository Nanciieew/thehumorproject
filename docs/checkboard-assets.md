# My Checkboard artwork

Reference: the user-selected Streak Celebration mockup, `exec-47ac4605-d488-4917-8a40-6caa5e6e7b14.png`.

Separate production assets in `public/checkboard/`:

- `mascot.png`: glossy winking sphere and both rounded hands, transparent RGBA 1536 × 1024.
- `glass-bubbles.png`: smoky olive/yellow glass bubble cluster, transparent RGBA 1829 × 860.
- `glass-checkmark.png`: tall chunky translucent glass checkmark, transparent RGBA 1195 × 1316.
- `streak.svg`, `thumb-up.svg`, `thumb-down.svg`: separate native vector stat icons.
- `sparkle.svg`: small four-point star with a soft yellow glow, native vector.

The raster assets were generated using the built-in image-generation tool with the mockup as reference and `transparent_background: true`. They are positioned independently in HTML/CSS. The page does not use the full mockup as a background.

Generation prompts:

1. Isolate only the large glossy lemon-yellow 3D winking sphere from the upper right, including both separate rounded hands. Preserve face, polished resin material, reflections, proportions, and pose. Entire mascot visible on transparent alpha. Remove UI, panels, text, stars, bubbles, floor, and ledge.
2. Recreate the hero's smoky olive glass bubble cluster with yellow rims, wide composition, transparent background; no mascot, UI, or text.
3. Extract/recreate the lower-left thick translucent olive-yellow glass checkmark, full silhouette, portrait framing, transparent background; no other objects.

The vote and flame symbols are independent SVG assets. User-uploaded memes and all counts remain live data rather than part of the artwork.
