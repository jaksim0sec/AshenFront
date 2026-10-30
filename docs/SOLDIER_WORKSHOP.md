# Soldier parts and animation workshop

Current authoritative settings: **ashenfront-soldiers-final (1).json**, preserved as `assets/soldiers/catalog-reference.json`. All16 profiles, including dimensions, position, pivots, rotation, visibility, weapon grips and layer order, are applied exactly. Factory defaults and the published catalog match the complete export. Earlier per-part references below are historical; national/rank fitting anchors now come from this full export. New browser drafts use `ashenfront.soldier-workshop.v4` so older saved drafts cannot override the new default. No PNGs, game rules or command/AI transplant code were changed by this update.

Run `npm start`, then open **병사** in the game header or `/soldier-workshop.html`.

## Current reference and physique

National fittings now follow the four exports in `assets/soldiers/fitting-references/`: each nation’s lieutenant sets all of its officer caps; Velian private sets every blue helmet; Arken corporal sets the left/right sleeve placement and rotation across ranks and nations. Each rank keeps its own patch artwork, original aspect ratio and visibility. Different patch shapes use native calibrated dimensions. These fittings also survive **체면동화** and update earlier drafts once through `fittingsRevision`. Other body geometry, rifles and animation are unchanged.

`assets/soldiers/physique-reference.json` is the supplied **ashenfront-arken-private-1.json**. The published16-profile catalog and factory defaults use its exact Arken private geometry and layer order. Other nations/ranks retain their own artwork, uniforms and insignia.

**체면동화** copies the complete geometry for identical assets, including hat position, dimensions, pivot, rotation and scale. Different national hats/caps use their original head-fit registration points and uniform scaling. Insignia are transferred from their registered body/arm attachment. The transfer starts from asset calibration, rather than the target's previous draft, so stale hat offsets cannot survive or accumulate. Repeated unification is idempotent. Source PNG aspect ratios remain locked.

Older browser drafts receive this reference once via `physiqueRevision`, then subsequent manual edits remain editable and exportable. Head and hat editing starts independently; **머리·모자 함께 이동** is optional.

The native images are from `uniform-parts-crops-1.zip`, with the four whole-arm PNGs and rig patch from `uniform-arms-rigged.zip`. Arken uses `black`, Velian uses `blue`. All36 supplied PNG bytes are unchanged. Archive/PNG checksums and bounds are in `manifest.json`; the merged source rig and arm patch are retained alongside it. Approved flags are unchanged. No new elbow pieces, limb segments, uniforms or rank artwork are generated.

## Aiming and animation

The rifle is now20% larger (141.6×35.4 rig units), with its original4:1 aspect ratio. Existing drafts enlarge once via `rifleRevision`; later edits retain their selected size.

Death now keeps the entire soldier connected: a brief loss of balance, an accelerating sideways fall, ground impact, a small damped rebound and a still body before fading. Head, hat, arms, legs, insignia and rifle share one body transform; none detach or scatter. Ground correction moves the complete silhouette together. Contact now uses opaque PNG silhouette hulls instead of transparent bounding rectangles or rifle extent. It holds the original standing sole plane at every frame, without a delayed lift. The fallen shadow follows the body, and a moving unit keeps its last interpolated foot position at death instead of snapping back to a tile. Breathing stops at death. The battlefield, cache and editor share the1.7s duration.

Firing keeps the edited rifle position fixed, eliminating aim-dependent jumps between arm-reach solutions. The arms rotate/translate as whole images without changing their configured scale. Their original palms follow the fore-end, trigger and bolt anchors.

The battle passes the actual projected target point relative to the rendered, interpolated soldier, including elevation. The animation transforms that point into the moving torso frame and solves the angle of the actual barrel ray, including its offset from the rifle pivot. Recoil, breathing, movement and left/right reflection use the same coordinate transforms. The cached right-facing sprite reflects its target as well as its image. Coarse firing-angle rounding has been removed; the tracer uses the same sampled muzzle as the rendered rifle.

The native portrait faces left and the SVG rifle points right; their facing convention is normalized consistently. Every animation respects the user-exported layer order, including the rifle. Existing flash, bolt cycling, casing, tracer, hit, walking and falling effects remain cosmetic and do not change combat damage or simulation randomness.

## Edit and export

1. Select country, rank and part. Drag or enter position, size, rotation, pivot and uniform scale. Preview, pause, scrub, aim, flip and compare ranks.
2. Apply **체면동화**, change visibility or layer order, undo/redo, or reset a profile.
3. Download the full `ashenfront-soldiers-final.json` or one profile. Both import again. Unknown images, external URLs and invalid numbers are rejected.
4. **전장에 적용** saves the browser draft and opens the game. An already-open game receives the same catalog through a storage event. Clearing a draft restores the published defaults.

Current browser storage key: `ashenfront.soldier-workshop.v4`. Export JSON to transfer edits between browsers.

To publish exported adjustments:

```sh
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json --check
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json
```

The helper validates before atomically replacing `assets/soldiers/catalog.json`; single-profile exports merge into the published catalog. The source-archive importer only regenerates native asset calibration. The user reference remains a separate layer of calibrated adjustments.

## Focused verification

`node --test --test-isolation=none tests/characters.test.mjs`:15 passed. Checks include exact reference geometry, identical helmet transforms, repeated unification without drift, old-draft migration, unchanged PNG checksums, original aspect ratios, fixed arm scale, actual barrel-ray alignment through recoil/reload and both facings, reflected cache targets, rifle grip attachment, JSON round trips and pose bounds.

A real Chromium capture compares nation/rank physique and left/right firing, upward/downward aim and reload poses: `docs/soldier-evidence/physique-and-aim.png`. A focused live-game check also confirms the rendered barrel ray reaches four projected target directions, with no page errors.

Broad game suites, mobile/hardware validation and performance profiling were not repeated. The sprite cache remains bounded to256 frames /16MiB with384px maximum bitmap side. Accurate moving-target firing can require additional cache entries; no new performance improvement is claimed. Older files in `docs/soldier-evidence/` are historical artwork evidence.
