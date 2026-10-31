# AshenFront trench asset, v2

The previous 10-cell atlas produced a dark slab with repeating ladder planks
and vertical picket fences. That was a bad fit for the game's natural soil
textures and looked like an object sitting *above* the terrain.

## Replacement art

The existing `assets/world/terrain/trench-atlas.svg` retains the hard
native geometry: **720 × 214 pixels, 5 × 2 cells of 144 × 107**. It is
loaded and cached as the actual battlefield's trench asset.

- Cells 0–3: **mostly transparent** soil disturbance, muted erosion and
  sparse pebbles. The game's naturalistic soil atlas remains clearly visible
  through them. No repeated artificial planks.
- Cells 4, 5, 8, 9: shallow exposed earth bank, irregular eroded top, layered
  soil with fine noise. No wooden palisade or prominent upright posts.
- Cells 6–7: faded soil ramp wear on the real reciprocal exits, without
  staircase or ladder drawings.
- The sample trench is a **two-cell**-wide connected zigzag instead of a
  three-cell dark rectangle. Ramp coordinates and crossing permissions remain
  unchanged.
- Height geometry and per-soldier depth clipping still come from the game
  engine rather than SVG pixels; the latter are visual assets only.
- Draw once into the existing viewport's terrain cache. All old terrain rows,
  ordinary cliffs, unit assets, navigation and commands remain unchanged.
- The SVG is automatically included in versioned offline PWA releases.

`tests/terrain-art.test.mjs` checks the atlas grid, surface and ramp indexing,
cache invalidation and absence of old ladders. Chromium's mobile run also
checks actual image decode and sampled mud alpha: the overlays must be
transparent enough not to hide existing ground textures. Appearance still
requires manual review of the real gameplay scene.
