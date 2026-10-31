# Trench tileset (active renderer)

## Exact image geometry

`assets/world/terrain/trench-atlas.svg` is an actual SVG image atlas:
**720 × 214 image pixels, 5 columns × 2 rows, ten 144 × 107 cells**.
Every cell aligns to the existing diamond footprint:
top (72,3), right (144,44), bottom (72,86), left (0,44).

| Cell | Atlas coordinates | Content |
| --- | --- | --- |
| 0–3 | (0–432, 0) | four dark soil/boarded trench beds |
| 4 | (576, 0) | E-facing timber-reinforced earth bank |
| 5 | (0, 107) | S-facing timber-reinforced earth bank |
| 6 | (144, 107) | W-facing exit ramp |
| 7 | (288, 107) | E-facing exit ramp |
| 8 | (432, 107) | alternate E earth bank |
| 9 | (576, 107) | alternate S earth bank |

## Rendering contract

- The legacy `ashenfront-atlas.webp.b64` remains the base ground texture.
- Low-level (0) floor tiles draw soil/board-bed art after the base texture.
- Explicit reciprocal `board.heightRamps` select ramps on low tiles.
- Terrain bank images replace only level 1 → 0 earth walls; level 2
  hills keep their old slope rendering.
- Every image is composited into the **static viewport page**. No extra
  draw call per unit or frame when that page is reused.
- Existing `terrain-occlusion.mjs` continues to mask foreground
  terrain polygons per soldier. The real 22px earth-wall art matches
  the existing geometry and does not replace occupancy/pathfinding.
- Browser image loading verifies the atlas natural width and height,
  increments the viewport version once on successful decode and leaves
  the ground-only fallback when decoding fails.
- The PWA asset walker automatically includes SVG so the tile set is
  available offline in the same fingerprinted release.

Verification: `tests/terrain-art.test.mjs` asserts native image dimensions,
every sprite slot, real terrain sprite source coordinates, ramps, wall
selection and viewport cache invalidation. `tests/flowerwars-browser.py`
confirms the SVG is decoded at 720×214 in an actual Chromium battlefield,
including mobile mode. Manual aesthetic review is still required.
