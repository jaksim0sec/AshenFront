# Soldier parts and animation workshop

Run `npm start`, then open **병사** in the game header or `/soldier-workshop.html`.

## Current artwork and proportions

The current source is **uniform-parts-crops-1.zip**. All36 native PNGs are copied byte for byte; Arken uses `black`, Velian uses `blue`, and both use the same shared head and legs. The archive's `rig.json` is preserved in `assets/soldiers/rig.json`. Its assembly coordinates, uniform scales, native pivots, rotations and ascending layer order now define the default appearance. The earlier archive and its hand-calibrated defaults are replaced.

The entire640×800 assembly receives one global scale (`100 / 312`) and foot-origin translation (`320, 732.6`) to fit the existing battlefield. Visible torso width is therefore100 game rig units, head width280/312×100, hat width390/312×100, arm height218/312×100 and leg height126/312×100. Full native crops, including transparent padding, are rendered without changing pixel data or raster aspect ratios. Scaling is never applied twice. Source PNG checksums, visible bounds and the canvas conversion are recorded in `assets/soldiers/manifest.json`.

The archive provides six appearances per nation. These map to the existing eight game ranks: private; the three successive enlisted insignia; plain-epaulette officer for lieutenant/captain; striped-epaulette officer for major/colonel. Left and right insignia use their respective original files. No additional rank artwork, elbow parts or limb segments are generated. Approved faction flags remain unchanged.

Each arm remains one whole PNG. Idle poses use the exact archive placement. Sleeve insignia inherit the animated arm's change from its original matrix, preserving source placement and uniform scaling. Firing positions the whole original arms at the temporary SVG rifle's grip anchors. Existing recoil, bolt cycling, flash, casing, tracer, hit, walk and falling animations remain view-only.

## Edit and export

1. Select country, rank and part. Drag or enter position, size, angle, uniform scale and pivot values. Source aspect ratios stay locked. Head and hat move independently by default; enable **머리·모자 함께 이동** only when needed. Preview, pause, scrub, aim, flip and inspect the eight-rank strip.
2. **체면동화** applies the selected soldier's physique to all16 profiles in one undoable operation, preserving each nation's original raster aspect ratios, artwork and rank insignia.
3. Change images, visibility or layer order; undo/redo and reset the current profile. Export all profiles as `ashenfront-soldiers-final.json`, or export/import a single profile. Unknown image paths, external URLs and invalid numbers are rejected.
4. **전장에 적용** saves the draft and opens the game. An already-open game receives the same catalog through a storage event. Export JSON for another browser; clearing a draft restores published defaults.

This artwork generation uses browser storage key `ashenfront.soldier-workshop.v2`. Old drafts remain under the previous key but are not applied to incompatible replacement crops. Old-archive JSON is rejected rather than silently restoring its proportions.

To publish exported adjustments:

```sh
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json --check
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json
```

The helper validates before atomically replacing `assets/soldiers/catalog.json`. Single-profile exports merge into the published catalog. Clear a browser draft to see new published defaults.

`tools/import-uniform-parts.py <archive.zip>` reproducibly imports PNGs and generates `src/characters/uniforms.mjs` and `aspects.mjs` from this archive. The generator validates all hashes, dimensions, uniform scales and preset matrices before replacing assets. Published catalog adjustments are managed separately with the helper above.

## Focused verification for this replacement

- `node --test --test-isolation=none tests/characters.test.mjs`:12 passed. This includes checksums for all36 PNGs, all four transformed crop corners and layer order for every nation/rank against the supplied assembly matrices, aspect preservation, weapon grips, JSON round trips, animation bounds and dragging.
- `node tools/apply-soldier-catalog.mjs assets/soldiers/catalog.json --check`: valid16-profile published catalog.
- Real Chromium desktop check:37 decoded images including SVG, both nations' idle/firing previews, one complete image per arm, **체면동화** applied to all16 profiles, and actual game loading; no page errors.

Only focused checks were run for this replacement. Broad game tests, performance profiling, mobile and physical-device validation were not repeated. Earlier evidence in `docs/soldier-evidence/` belongs to the previous artwork. Current development captures are in ignored `artifacts/soldiers/new-uniform-*.png`.

The gameplay sprite cache still uses transformed bounds, a256-frame /16MiB LRU limit and384px maximum bitmap side. No new performance measurements are claimed. FlowerWars-MINI was used previously as animation/editor reference; its repository remains unmodified.
