# Terrain and Soldier Depth Composition

The old strategy of rendering every wall before or after entire actors is
incorrect. A soldier can be behind one surface and in front of another.

## Active renderer

- Keep terrain caps, walls and textures in the viewport canvas cache.
- Order actors by continuous world X+Y (camera depth), NOT projected Y offset
  by elevation.
- Before rendering each actor, calculate local occluders in at most a 9x9
  neighborhood of their current interpolated visual position.
- Surfaces above the actor's interpolated foot level are clipped by a
  continuous world-depth plane. Same-height supporting ground cannot mask
  its own soldier.
- Exposed east/south faces are also clipped along their diagonal depth range.
  A soldier may cover part of the same tile while that tile covers another
  part of the soldier.
- Apply each geometry piece using a sequential even-odd canvas clip inside
  the actor's own save/restore. No bank is repainted over earlier actors.
- Flat/no-height boards skip this work.

Navigation, pathfinding, terrain texture caching, and gameplay occupancy
remain unchanged. Legacy mergeDepthLayers remains exported for compatibility
but is no longer used by the active scene.

Tests cover same-cell competition, front and rear tiles, fractional movement,
actor-local masks, and viewport-independent map size. Browser screenshots
remain necessary to judge aesthetics and correct clipping in the UI.
