# Soldier parts and animation workshop

Run `npm start`, then open **병사** in the game header or `/soldier-workshop.html`.

The workshop provides two countries × eight ranks, independently editable and exported together as `ashenfront-soldiers-final.json`. Arken uses the supplied `arken` family; the game's Velian faction uses the ZIP's `belnian` family. User-approved faction flags from commit d727223 are preserved and displayed. Rank presentation is visual only: army leaders use captain artwork, squad leaders sergeant artwork, other infantry private artwork. There are no new combat stats or military unit classes.

## Edit and export

1. Select country, rank and part. Drag the part or enter position, size, angle, scale and pivot values. Arm and rifle hand anchors are editable. The head/hat movement link can be turned off. Shoulder and sleeve patches follow their attachment points.
2. Preview breathing, walking, firing/bolt cycling, hit response and falling. Flip direction, aim vertically, pause, scrub the timeline and show/hide joint/grip guides. The eight-rank comparison strip uses the same renderer.
3. Change layer order, visibility or the supplied image. Undo/redo, current-profile reset and completion/next controls are available. Repeated DOM change events do not duplicate undo entries. Dragging through rotated animation parents uses the inverse parent transform.
4. Export the full final JSON or a single-rank JSON. Both can be imported again. Unknown image paths, external URLs, invalid numbers and incompatible schemas are rejected before existing edits change.
5. Local drafts and editing position are stored in this browser. **전장에 적용** saves the draft and opens the real game; an already-open game receives the same validated catalog via a storage event. Export JSON to move edits to another browser. Clearing a draft restores the published default catalog.

To publish an exported configuration into the repository:

```sh
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json --check
node tools/apply-soldier-catalog.mjs ashenfront-soldiers-final.json
```

The helper validates all input before atomically replacing `assets/soldiers/catalog.json`. A single-profile export merges into the existing published catalog. Clear an old browser draft to see the newly published defaults.

## Assets and visual implementation

All41 source PNGs retain their original ZIP bytes. `assets/soldiers/manifest.json` records archive/PNG SHA-256 values and alpha bounds. The ZIP's `rig.json` was intentionally not read, copied or loaded. Placement, image pivots and skin-palm anchors were calibrated from the actual supplied artwork and inspected in real Chromium captures. Large transparent padding around the Arken helmet is handled by measured alpha bounds, rather than trusting the source canvas size.

The temporary rifle is an original local SVG silhouette. Both hands are attached to the actual SVG's normalized grip positions at editable dimensions, with shoulder/elbow/forearm assembly. Firing includes aim, recoil, a timed muzzle flash, bolt-hand movement, case ejection, return to aim, a short traveling tracer and impact accents. Walking can blend with firing. Death/hit/breathing animation is view-only. Shot/elimination events add actor IDs so visuals follow the correct soldier; they do not schedule extra damage or consume simulation randomness.

Sprites remain anchored to the real H0/H1/H2 feet and the existing trench foreground mask. Moving-shot origins use the rendered interpolated muzzle and retain that cosmetic origin thereafter. Death frames and larger edits use transformed pose bounds, rather than a fixed crop. The sampled frame cache uses LRU eviction, at most256 frames /16MiB and384px maximum bitmap side. Distant/low-power poses use fewer samples. Idle/walking phase shifts share cycle frames instead of multiplying the cache by actor phase. Live editor rendering uses full-resolution parts and is not subject to the gameplay frame cache.

FlowerWars-MINI at0d4e7a513c6fe02ab864fb6335792bd9d2280312 was inspected for its archer grip/release behavior and adjustment/export workflow. No FlowerWars code, characters, weapons, repository files or assets were modified or copied.

## Executed verification and limits

- Full Node suite:62 passed,0 failed. Focused character suite:11 passed, including real drawn SVG grips at resized dimensions, image-palm alignment, mirrored firing, rotated dragging, pose bounds and cycle sampling.
- Actual workshop browser checks at1400×1000/DPR1 and390×844/DPR2:42 decoded images including the SVG;16 independent profiles; six rendered state/phase samples; JSON download/import; invalid import rejection; undo/redo; real touch drag; reload persistence; live game updates. No page errors.
- Additional browser checks verify a moving muzzle/tracer origin, render-independent authoritative checksum, adaptive cached death bounds and cache memory/count limits.
- Existing game interaction suite passed at390×844 and1280×800, DPR1/2, including moving selection, commands, support, match end and trench foreground pixels.
- Published catalog validation passed through the apply helper's `--check` path.

Initial profiling of real soldier battles exposed cache churn in a180-actor distant view (render p95 about38ms, with long tasks). The subsequent cache work shares phases, uses actual clipped part bounds and LRU eviction. At the user's request, extended/repeated profiling and additional broad tests were stopped; final performance improvements are **not** claimed as measured. Large battlefields remain developer fixtures. Physical Android performance and sustained thermal/memory testing were not performed.

Files in `docs/soldier-evidence/` retain the executed results and representative development captures. Assembly captures include the diagnostic guides and precede the final normalized-grip/cache refinements; they are development evidence, not a promise of pixel-identical final frames. Generated phase captures, exports and extra screenshots remain in ignored `artifacts/soldiers/`.
