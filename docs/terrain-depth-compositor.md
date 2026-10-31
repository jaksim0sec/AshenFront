# Terrain × Soldier Depth Composition

Status: integrated into the active AshenFront `fw-entry.mjs` renderer. This is a **render-only contract**, not a new pathfinding, collision, or trench gameplay system.

## Why
The original active renderer blitted the entire cached terrain first and then rendered all units. A raised face in front of a lower unit could never partially conceal that unit. A single zIndex bonus cannot solve tile/actor and tile/tile overlap.

## Chosen design
- Preserve `BattlefieldTerrainRenderer` viewport LRU, atlas decoding, and terrain material calculation.
- Optional `board.floorLevel` indexed by `y * width + x`, same convention as the earlier `src/render/projection.mjs`: **0 trench/recessed, 1 normal ground, 2 raised**.
- The existing background surface is drawn at projected foot elevation; visible elevated **caps** and exposed **south/east wall faces** become separate foreground occluders.
- Static face geometry is built only when the floor level reference, dimensions, or explicit `floorLevelRevision` changes. Index 16×16 tile regions; cache the sorted set for an unchanged viewport cell bounds.
- Actor and face lists are independently sorted by logical isometric ground depth. Merge the two sorted streams in linear time, preserving the existing sprite/canvas drawing path.
- Elevation-aware actor projection interpolates height for direct and allied-through-pass movement, and is also used for unit hit-testing and culling.

## Alternatives rejected
1. Per-tile actor comparison every frame: excessive for 512×384 maps with hundreds of units.
2. Full terrain rerasterization on every unit move: defeats viewport page caching.
3. More actor zIndex exceptions: does not handle wall/actor partial occlusion.

## Performance
`U` visible units, `F` visible front faces: **O(U log U + F)** each render. Height index rebuild is O(map tiles) only on a static height revision. Zero-height-map baseline has no face indexing. No O(U×F) collision checks and no scene canvas layers or DOM nodes. No GPU readbacks.

## Authoring and constraints
- Set a `Uint8Array(width * height)` as `board.floorLevel`, initialized to 1; 0/2 mark trench/ridge. Increment `floorLevelRevision` after mutating array contents.
- This does not automatically construct trenches, ramps, cover, or change physics. Those must use the same height contract when implemented.
- Dynamic destructible elevation and depth-sensitive props/flags are future integration points; currently headquarters, effects, and team overlays retain their existing drawing order.
- Never feed `visualY - height` back into navigation. Depth ordering uses ground footprint, altitude affects only screen projection.

## Verification
Tests cover no-height fast path, face-unit interleaving, trench cap occlusion, deterministic equal-depth ordering, cached viewport results and revision invalidation, height interpolation across both ordinary/allied passage, and map-size independence.

## Interactive browser scenario
Append `?terrainTest=1` to the deployed game URL. This mode uses the normal match deployment logic to place an already-selected 10-person A squad beside the sample trench, deploys the remaining troops, starts the real bot battle and focuses the camera on the height features. Tap the map to issue squad orders onto/through the trenches and ridges. An ordinary URL preserves manual deployment. Restart keeps the debug mode.
