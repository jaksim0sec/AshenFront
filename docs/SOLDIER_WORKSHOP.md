# Soldier parts and animation workshop

Run `npm start`, then open **병사** in the game header or `/soldier-workshop.html`.

## Current reference and physique

`assets/soldiers/physique-reference.json` is the supplied **ashenfront-arken-private-1.json**. The published16-profile catalog and factory defaults use its exact Arken private geometry and layer order. Other nations/ranks retain their own artwork, uniforms and insignia.

**체면동화** copies the complete geometry for identical assets, including hat position, dimensions, pivot, rotation and scale. Different national hats/caps use their original head-fit registration points and uniform scaling. Insignia are transferred from their registered body/arm attachment. The transfer starts from asset calibration, rather than the target's previous draft, so stale hat offsets cannot survive or accumulate. Repeated unification is idempotent. Source PNG aspect ratios remain locked.

Older browser drafts receive this reference once via `physiqueRevision`, then subsequent manual edits remain editable and exportable. Head and hat editing starts independently; **머리·모자 함께 이동** is optional.

The native images are from `uniform-parts-crops-1.zip`, with the four whole-arm PNGs and rig patch from `uniform-arms-rigged.zip`. Arken uses `black`, Velian uses `blue`. All36 supplied PNG bytes are unchanged. Archive/PNG checksums and bounds are in `manifest.json`; the merged source rig and arm patch are retained alongside it. Approved flags are unchanged. No new elbow pieces, limb segments, uniforms or rank artwork are generated.

## Aiming and animation

Firing keeps the edited rifle position fixed, eliminating aim-dependent jumps between arm-reach solutions. The arms rotate/translate as whole images without changing their configured scale. Their original palms follow the fore-end, trigger and bolt anchors.

The battle passes the actual projected target point relative to the rendered, interpolated soldier, including elevation. The animation transforms that point into the moving torso frame and solves the angle of the actual barrel ray, including its offset from the rifle pivot. Recoil, breathing, movement and left/right reflection use the same coordinate transforms. The cached right-facing sprite reflects its target as well as its image. Coarse firing-angle rounding has been removed; the tracer uses the same sampled muzzle as the rendered rifle.

The native portrait faces left and the SVG rifle points right; their facing convention is normalized consistently. Every animation respects the user-exported layer order, including the rifle. Existing flash, bolt cycling, casing, tracer, hit, walking and falling effects remain cosmetic and do not change combat damage or simulation randomness.

## Edit and export

1. Select country, rank and part. Drag or enter position, size, rotation, pivot and uniform scale. Preview, pause, scrub, aim, flip and compare ranks.
2. Apply **체면동화**, change visibility or layer order, undo/redo, or reset a profile.
3. Download the full `ashenfront-soldiers-final.json` or one profile. Both import again. Unknown images, external URLs and invalid numbers are rejected.
4. **전장에 적용** saves the browser draft and opens the game. An already-open game receives the same catalog through a storage event. Clearing a draft restores the published defaults.

Current browser storage key: `ashenfront.soldier-workshop.v3`. Export JSON to transfer edits between browsers.

To publish exported adjustments:

```sh
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json --check
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json
```

The helper validates before atomically replacing `assets/soldiers/catalog.json`; single-profile exports merge into the published catalog. The source-archive importer only regenerates native asset calibration. The user reference remains a separate layer of calibrated adjustments.

## Focused verification

`node --test --test-isolation=none tests/characters.test.mjs`:13 passed. Checks include exact reference geometry, identical helmet transforms, repeated unification without drift, old-draft migration, unchanged PNG checksums, original aspect ratios, fixed arm scale, actual barrel-ray alignment through recoil/reload and both facings, reflected cache targets, rifle grip attachment, JSON round trips and pose bounds.

A real Chromium capture compares nation/rank physique and left/right firing, upward/downward aim and reload poses: `docs/soldier-evidence/physique-and-aim.png`. A focused live-game check also confirms the rendered barrel ray reaches four projected target directions, with no page errors.

Broad game suites, mobile/hardware validation and performance profiling were not repeated. The sprite cache remains bounded to256 frames /16MiB with384px maximum bitmap side. Accurate moving-target firing can require additional cache entries; no new performance improvement is claimed. Older files in `docs/soldier-evidence/` are historical artwork evidence.
