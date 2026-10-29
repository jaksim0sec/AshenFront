# 灰燼戰線 (AshenFront) — Core Gameplay Implementation Specification

> Status: DESIGN ONLY · Version 0.2 · 2026-10-29
> Repository: https://github.com/jaksim0sec/AshenFront
> Reference project: https://github.com/jaksim0sec/FlowerWars-MINI
> This document is an implementation contract, not proof of completed development. Numbers are starting hypotheses requiring playtesting.
> No changes to FlowerWars-MINI. No new branch required. Do not silently expand scope.

## 0. Goal, non-goals, priority

**Goal:** Build a playable, performant, mobile-first, 2.5D isometric RTS based on fictional early-industrial trench warfare. Preserve the approachable small-character presentation of FlowerWars-MINI while changing the actual gameplay: positional cover, line-of-sight, suppression, limited off-map support, dynamic control of trench sectors, and three discrete standing elevations.

**Priority order:** 1) correct game rules and commands, 2) reliable group movement and objective resolution, 3) mobile performance, 4) minimal readable rendering, 5) optional military art/lore/UI embellishment.

**Explicitly NOT in initial core:** elaborate uniforms or national backstory; individual inventories; ammo, morale, hunger, disease, weather, vehicles, aircraft, realistic ballistics, procedural trench digging, fully destructible geometry, online play, campaign, monetization, large UI frameworks, new pathfinding libraries, WebGL conversion, or general-purpose ECS. Introduce one only after measurements and separate authorization.

### Requirement IDs and completion gates

| ID | Deliverable | Definition of done | Depends on |
|---|---|---|---|
| AF-01 | Board + 3 elevations | A 64×48 scene has H0/H1/H2, correct rendering, legal height changes only | none |
| AF-02 | Squad navigation | Select and move 10-member squads without overlapping occupied/reserved tiles or infinite waiting on feasible routes | AF-01 |
| AF-03 | Ranged combat | Deterministic visibility, target choice, cooldown, damage, elimination, cover effects | AF-01, AF-02 |
| AF-04 | Suppression | Combat changes squad movement; UI explains temporary stops; recovery works | AF-03 |
| AF-05 | Objectives + outcome | One central control point produces a finite, testable 40v40 match | AF-02–04 |
| AF-06 | Minimal enemy bot | Same rules as player; actively contests/defends objective, cannot inspect hidden enemy state | AF-05 |
| AF-07 | Tactical support | One simple area support action; no per-projectile physics | AF-03–06 |
| AF-08 | Scaled battlefield | 256×192 with 3 sectors, 180v180 as a target only after performance gates | AF-01–07 |
| AF-09 | Mobile UI + renderer | Touch controls, zoom bounds, height readability, minimal map overview, graceful low-end mode | AF-01–08 |
| AF-10 | Tests + reproducibility | Browser and simulation reproducibility; benchmark evidence before declaring ready | all |

**Deliverable interpretation:** P0 is a complete small game loop; P1 scales the same stable core. A stage cannot be called complete because its code compiles. Require the listed tests and observable play behavior.

## 1. P0 playable game definition (freeze scope)

- Environment: static web app, ES modules, Canvas 2D, Node 22 for tests/tools only. No backend, account, or external APIs.
- Map: **64×48**, hand-authored deterministic layout. 3 elevation levels H=0/1/2 (see §2).
- Teams: A / B. Single soldier archetype using temporary solid-color silhouette; differences are team color, not separate mechanics.
- Forces: **4 squads × 10 soldiers = 40 per team**; each squad has one selectable ID and ten existing soldier IDs. All soldiers share identical stats.
- Starting deployment: fixed, symmetrical accessible positions. Start battle immediately; no 5-minute setup phase in P0.
- Commands: SELECT, MOVE(destination tile), HOLD, RALLY(target sector). Selected squad keeps last valid intent. Invalid order displays a reason, does not silently erase previous command.
- Combat: periodic abstract fire evaluation, LOS, damage, directional trench cover, group suppression. No projectiles simulated as physical objects.
- Objective: **one central sector**, area occupancy, uncontested ownership, 45-second uninterrupted hold to win; fallback match end at 8 real-time minutes with score comparison and draw allowed.
- Enemy: low-cost deterministic control-point bot. Can hold positions, contest central sector, react to visible opposing squads.
- Rendering: terrain + stepped walls + character shapes + small effects/selection + 3 concise labels. No asset-production dependency.
- Target: complete an entire match in mobile Chromium and physical Android without command stalls. P0 is not automatically authorized to become a 256×192 game until it passes the gates.

## 2. Elevation, trenches, visual projection (fundamental architecture)

### 2.1 Exactly three floor levels

**One world cell has one floor, not three simultaneously stackable floors.** This keeps tile occupancy, world addressing and pathfinding compatible with the existing 2D spatial approach.

| floorLevel | Meaning | Typical terrain | Relative character foot height |
|---|---|---|---|
| 0 | lowered surface | trench bottom, sunken passage | bottom |
| 1 | reference ground | field, roads, destroyed village | middle |
| 2 | raised surface | ridge, elevated earthwork, embankment | top |

Default world is H1. H0 is mostly connected trench corridors. H2 is sparse, deliberate high ground, **not a second full map**. Cells may have the same x/y only at exactly one current floor level. No bridges, caves, overlapping two-story occupancy, or unit stacking in P0/P1.

- Height is a discrete logical integer (0/1/2); visual height in pixels is configurable independently.
- Floor height DOES affect movement connectivity, LOS and render position. It does not inherently multiply damage or movement speed.
- Height does NOT change during P0/P1 shell effects. Terrain wear may change cover and visual decals only.
- H2 must be visibly present in the P0 test scene, even if it occupies a small area, so the 3-level approach is genuinely validated.

### 2.2 Terrain arrays, no heavyweight Tile objects

For width W and height H, `i = y * W + x`.

| Array | Type | Value / interpretation |
|---|---|---|
| floorLevel | Uint8Array(W×H) | 0,1,2 |
| terrainKind | Uint8Array | 0=field,1=trench,2=ridge,3=ruin,4=blocked |
| blocked | Uint8Array | 0=walkable,1=unwalkable |
| transitionMask | Uint8Array | 4 N/E/S/W bits indicating explicit climb/descent connection |
| coverMask | Uint8Array | 4 N/E/S/W bits of protected incoming directions |
| coverCondition | Uint8Array | 0–100, 100 undamaged |
| occupancy | Int32Array | 0=empty, positive soldier ID |
| reservation | Int32Array | 0=unreserved, positive soldier ID |

These are distinct arrays to prevent conflating appearance, floor elevation, traversal and cover. Store mutable state separately from prebuilt layout and use dirty-cell identifiers for visual cache invalidation.

### 2.3 Exactly when height transitions are legal

Only 4-direction movement in P0 (N/E/S/W). For adjacent cells a,b:

1. Both inside board and walkable.
2. If same floor level, movement allowed unless a dedicated blocking-edge flag denies it.
3. If floors differ by exactly 1, movement allowed **only** if the directed edge has an authored transition (ramp/stairs/trench exit), with a reciprocal connection on the neighbor.
4. Difference of 2 always impassable.
5. No diagonal corner cutting and no teleporting up a level.
6. Independent of these rules, destination must pass occupancy/reservation checks when executing a step.

**Important:** A transition edge is part of the map data, not inferred from a sprite. P0 supports fixed entry/exit locations. Do not allow soldiers to step from every trench-edge tile to the ground just because |Δheight|=1.

Use floor topology tests that find at least two connected, independent trench exits on each side of the map; avoid single-cell entrances as the only route for an entire army.

### 2.4 Isometric projection, standing height and occlusion

Reuse the verified planar projection concept from FlowerWars-MINI:

~~~js
const HALF_W = 72;
const HALF_H = 42;
const LEVEL_PX = 22; // tunable rendering value, not game physics
function project(x, y, floorLevel) {
  return {
    x: (x - y) * HALF_W,
    y: (x + y) * HALF_H - floorLevel * LEVEL_PX
  };
}
~~~

- Unit feet are anchored at project(x,y,floorLevel). Their pivot, selection ring and hit-area all follow the raised/lowered foot position.
- For neighboring tiles with different levels, render visible vertical earth faces/side walls. Do not simply lift disconnected diamonds.
- On H0 trench tiles, dark recessed floors and front-facing soil-wall overlays conceal part of a soldier's lower silhouette. A character must look **inside**, not **on top of**, a trench.
- H2 edges receive corresponding raised side faces; renderer depth-sort by **projected feet Y with stable ID tie-breaks**. Some front-facing walls render after characters to create correct overlap.
- Screen picking: inverse-project ground candidates at H0/H1/H2 around the pointer, test visible diamond polygons in front-to-back order and return the topmost *visible* pickable tile. Do not only inverse-project H1; that makes H0/H2 taps drift.
- Camera projection and simulation heights are separated. Changing LEVEL_PX must not alter hit chances or legal navigation.

### 2.5 Sight lines and trench cover

The world must not confuse LOS with cover.

**LOS** answers whether a shooter may register a target. **Cover** reduces damage from a direction after a valid shot. **Elevation** changes which terrain can interrupt LOS. These are three separate computations.

P0 deterministic sight algorithm:

1. Candidate target must be within abstract distance cap (9 tiles) and alive.
2. Rasterize a line through intermediate cells (supercover grid line or deterministic Bresenham with adjacent-cell corner checks). A blocked opaque ruin rejects LOS.
3. Compare intermediate surface/obstacle top against an interpolated abstract sight height. Initial standing eye heights: H1→1.7, H2→2.7; H0 trench firing pose→1.55. These **are abstract game units**, not real weapon geometry. H0 firing pose only affects test visibility, not animation state.
4. Intermediate H2 ridges interrupt a level-H1 line; a normal H1 surface between H0 shooter and H1 target does not automatically make all trench fire impossible. Surface blocks only if floor+0.2 exceeds sight line, excluding its own origin/target cells.
5. TerrainKind=blocked may be opaque regardless of floor. An edge can carry explicit opaqueWall boolean if needed; P0 can use only opaque blocked cells.
6. A LOS result has no side effects. Cache it only while geometry/visibility revisions remain unchanged.

The shooter/target positions and tie-break rules must be symmetric under team swapping on a mirrored map. This is a game abstraction, **not physical ballistics**. If P0 camera/LOS data reveals unintuitive trench firing, revise the chosen abstract eye heights and record why.

Cover derivation:

- CoverMask is stored per target tile; bits face the direction **from target toward attacker**.
- Choose dominant direction by |dx|>=|dy| (ties resolve X). Example: enemy east of target → use E bit.
- If bit is present and coverCondition>0, damage multiplier starts at **0.50 for trench**, **0.75 for elevated earthwork**, otherwise 1.00. Coverage quality linearly weakens with condition below 50. No immunity.
- H0 itself does **not** grant omnidirectional defense. Cover must be authored on its relevant sides.
- The cover calculation must produce the same answer independently of render direction or camera.

## 3. Simulation data contracts

Use a stable, testable **simulation-only** core with no DOM/Canvas imports.

~~~ts
type TeamId = "A" | "B";
type Unit = {
  id: number;
  team: TeamId;
  squadId: number;
  x: number; y: number;            // integer authoritative cell
  visualX: number; visualY: number; // interpolation only
  hp: number;                      // 0..100
  nextFireTick: number;
  moveProgress: number;            // 0..1 for a reserved step
  moveTo: number;                  // cell index or -1
};
type Squad = {
  id: number;
  team: TeamId;
  unitIds: number[];
  order: "hold" | "move" | "rally";
  goal: number | null;
  suppression: number;             // 0..100
  lastThreatTick: number;
  movementBlockedReason: null | "congestion" | "no_route" | "suppressed";
};
type Objective = {
  id: number;
  center: number;
  radius: number;
  owner: TeamId | null;
  contested: boolean;
  progressTicks: number;
};
type WorldState = {
  tick: number;
  seed: number;
  map: TerrainArrays;
  units: Unit[];
  squads: Squad[];
  objectives: Objective[];
  winner: TeamId | "draw" | null;
};
~~~

These are conceptual contracts; TypedArrays and Maps may be used internally. Keep render interpolation state outside durable save format or explicitly mark it non-authoritative. No unit-specific animation objects in combat snapshots.

### Invariants (assert in debug and tests)

- Alive unit occupies exactly one tile; no two alive unit IDs share the same cell.
- Reserved destination of an active move belongs to exactly one unit.
- A soldier's stored floor always equals floorLevel at its actual cell; **no independent unit.z that can desync**.
- All squad references point to existing units, including when soldiers are removed.
- No move commits into blocked cells or unconnected height transitions.
- A new squad order does not reset already committed movement halfway through an interpolated step.
- Damage is never applied twice for the same scheduled event.
- Deterministic outcome is a pure function of initial seed + ordered player commands + ticks.
- Camera location, FPS, device performance and UI interactions unrelated to orders cannot change combat outcomes.

### Fixed-time loop

- Authoritative timestep: **50ms (20Hz)**.
- Accumulate elapsed wall time; run up to **3 simulation steps per render frame**; record backlog and slowdown if a sustained device cannot keep up. Do not silently skip ticks and pretend real elapsed time is preserved.
- Render via requestAnimationFrame with interpolated movement; initial 30FPS mobile target, not an engine guarantee.
- Movement: each 50ms tick progresses existing steps and schedules new steps.
- Fire: cooldown-driven checks staggered by unit ID, each soldier nominally once every **30 ticks (1.5s)**.
- Group targets/orders: refresh around every 10 ticks (0.5s), offset by squad ID.
- Bot intent selection: every 20 ticks (1s) or on a major event; avoid per-frame global replanning.
- Objective score: every 5 ticks (0.25s), with tick-count-based hold duration.
- Use seeded PRNG (xorshift32 or equivalent) for simulation decisions only. Visual particles use a separate RNG so changing graphics never changes winner.

## 4. P0 movement and squad control

### Commands, precise semantics

| Input | Data | Expected behavior |
|---|---|---|
| select squad | squadId | UI-only selection; no sim mutation |
| move | squadId, targetCell | Sets group target; replaces prior move/rally, keeps valid current movement step |
| hold | squadId | Cancels unstarted movement; existing reserved step may finish; retains fire capability |
| rally | squadId, sectorCell | Move toward nearby available positions and regroup; not exact-slot perfection |
| invalid command | reason | Reject atomically; preserve prior valid order and display reason |

Team ownership always checked in command adapter, including bot commands. No direct mutation from UI into arbitrary unit objects.

### Shared-route movement (do not naïvely A* every soldier)

1. When a MOVE order is issued, validate target and build/use a **shared static distance field** to its destination region using 4-way BFS over height-connectivity. No per-soldier full-map A*.
2. For each squad, build candidate landing cells in a small area near goal, excluding obstacles and incompatible levels. Maintain stable assignments only when needed; do not rearrange whole squad every 0.5s.
3. Each unit selects a legal neighboring cell that decreases distance, subject to occupied/reserved status. Choose alternatives minimizing distance + congestion penalty; deterministic tie-break by cell index and unit ID.
4. Reserve at most one pending destination per unit. Complete reservations atomically at the end of a step.
5. Chains of friendly units vacating cells may be committed together; mutually dependent cycles are resolved consistently, never double-occupying. If implementation cost is high in P0, reject unresolved cycles with explicit blocked reporting rather than faking movement.
6. If blocked continuously for 2s, attempt limited local alternate paths (radius 4–6 cells) using the same shared budget; do not regenerate global fields in a tight loop.
7. If no static route exists, set no_route and pause movement (not firing) until command/map changes.
8. If a route exists but dynamic crowding stalls progress, report congestion and retry with backoff. Any persistent feasible-route stall is a test failure, not accepted as “waiting”.
9. Group considers goal reached when >=80% of surviving members occupy the destination region, without requiring exact formation coordinates. Remaining stragglers continue joining.

**Passage design:** P0 trench floor should be at least 2 walkable cells wide on main movement segments, with multiple endpoints/exits. Avoid test levels made of one-cell serpentines; they only measure pathological reservations instead of the intended game.

**P0 budget:** start with <=2,048 static navigation expansions per 50ms tick across all queries (FlowerWars reference budget). Persist unfinished BFS jobs between ticks. This is a candidate, not a commitment to engine parity. Measure search backlog and adapt based on results.

## 5. Ranged combat and suppression (minimal rules)

### Single infantry archetype, initial tuning values

| Parameter | Initial value | Notes |
|---|---:|---|
| HP | 100 | only individual persistent health stat |
| attack range | 9 tiles | abstract map-space cap |
| shot interval | 1.5s | staggered cooldown |
| base hit probability | 0.55 at <=3 tiles | game tuning value |
| distance penalty | -0.035 per tile after 3 | clamp chance to 0.22..0.55 |
| damage on hit | 20 HP | multiplied by directional cover |
| step duration | 0.40s | no sprint/crawl system initially |
| squad suppression | 0..100 | squad-level only, no soldier-level morale |
| suppression gain | +2 per incoming evaluated shot at squad | cap 100; even a miss can create pressure |
| suppression recovery | -8 per second if 2s without incoming shots | smaller/zero recovery while threatened |
| suppressed threshold | >=65 | pause forward MOVE/RALLY, still allow HOLD and return fire |
| resume threshold | <=35 | hysteresis prevents status flicker |

For one shooter:
1. If alive and current tick >=nextFireTick, query nearby *visible* enemy candidates from a spatial index, not all world units.
2. Select closest valid enemy, then lowest ID as tie-break. A simple per-unit cache with <=0.5s expiry is sufficient.
3. Evaluate LOS and seeded hit roll. Register incoming pressure to target squad.
4. On hit, apply HP damage × directional cover multiplier, clamp HP >=0. At zero HP, release occupancy/reservations and remove the actor from future targeting.
5. Set nextFireTick=tick+30. Any attack animation/sound reads this combat event; it must not control damage timing.

**Critical:** suppression is a *reasoned temporary state*, not mysterious AI failure. Show “제압 74 / 전진 정지” in selected squad info, retain order, and automatically resume after recovery unless a newer order was given.

No persistent body objects, graphic injury effects, individual ammunition, recoil physics or per-bullet actors in P0. Small visual muzzle/event sprite is optional after game logic passes.

## 6. Trenches, capture and match end

### Minimal trench gameplay

- Enter via an authored connection ramp; H0 tiles provide directional cover.
- Being inside trench changes appearance, occupancy and incoming-fire rules but is NOT a separate unit class.
- A trench is an ordinary collection of walkable H0 cells plus edges, not a hierarchy of linked Scene objects.
- Reserve specific corridor capacity for moving units. Occupants should not constantly shuffle solely to create cosmetic rows.
- Destroying coverCondition may reduce protection but **cannot destroy the cell or alter height** in P0/P1, avoiding costly topology rebuild.
- All cover edges and ramp links are visible in debug view.

### P0 objective

- Point: central tile region (radius 4 Manhattan tiles, test exact geometry).
- Presence: each team contributes living soldiers currently inside, excluding units still reserved outside.
- Neither team inside: retain current owner, progress frozen.
- Both inside: contested; progress frozen.
- One team inside: that team becomes the active contender; on switch of contender, reset 45s progress; each objective evaluation tick adds elapsed tick count.
- **Win only after 45 continuous uncontested seconds** for one contender. At P0's **8-minute** limit, compare ownership and accumulated uncontested control duration; equal scores → draw. Avoid win-by-touch.
- Show current contender, remaining hold time, and “경합 중” when contested.

P1 replaces this with 3 control sectors and a 20-minute cap. Retain the same capture code parameterized for sector count and win rule; do not build two separate capture engines.

### Example P0 map topology (logical, not artwork)

- 64×48 board, teams spawn around x=6 and x=57; their mirrored H0 trench networks center near x=17 and x=46.
- Central contested control at approximately (32,24), H1 ground, with open approach areas.
- Small H2 raised ridges toward the north and south, not a continuous wall isolating the objective.
- At least 2 traversable ramps connecting each trench network to H1.
- At least 2 distinct A-to-central and B-to-central routes, validated by BFS.
- Avoid symmetric sightline bias in map generation; mirror by coordinates for the very first fixture, then validate with team swapping.

## 7. Enemy AI (minimal, competent, no “intelligent” theater)

P0 bot follows the same command adapter as the player. It does not read full hidden enemy data; evaluate only visible enemy actors and objective state.

**Every 1 second per squad** (stagger):
- If suppression>=65, keep its existing intent and hold until recover.
- If near/on objective and no immediate need to move, HOLD.
- If objective uncontested by own troops, MOVE toward an available area of the objective.
- If squad is already advancing toward a valid goal, do not issue the same order again.
- If a nearby squad is visibly in trouble, one available squad may shift to contested objective; cap redeploy frequency to prevent flip-flopping.
- Assign squads across a small number of predefined approach regions rather than all going to the identical tile.

Keep deterministic decision priority and minimum 3s order-change cooldown unless the old order is invalid. No teleport, perfect map-wide enemy tracking, cheating team resources, morale trees, individual autonomous agents, or dozens of named doctrines in P0.

**AI acceptance:** in 20 seeded bot-vs-bot matches, both teams should attempt to contest objective; not all games can time out from two mutually idle teams. Measure wins/draws, time spent moving, idle reasons and capture progress, not only casualties. Team-mirrored seeds should not show systematic spawn advantage without investigation.

## 8. Minimal UI and input

Render the gameplay first with simple shapes:

- World: earth-colored diamonds with exposed height faces, H0 dark trench floors, H2 light side edges; simple colored soldiers (blue-gray A, olive-brown B). No uniforms, flags, weapon illustration or detailed smoke necessary to pass P0.
- Top: elapsed time, objective owner/progress and team remaining count.
- Selected squad mini-panel: name/ID, living count, order, suppression value, movementBlockedReason.
- Bottom commands: MOVE, HOLD, RALLY, CANCEL ORDER MODE. Compact tap areas >=44 CSS px; touch/pinch cannot trigger accidental orders.
- Pan by one-finger drag on empty battlefield, pinch to zoom; tap selects friendly soldier/squad; destination tap after MOVE sets order; second tap does not replace order unintentionally.
- Camera zoom: **P1 candidate range 0.30–1.60** (subject to viewport tests); do not use full-fit zoom to show all 256×192 soldiers. P0 can use a range appropriate to the small board.
- P1 tactical overview: flat 2D terrain contour, objective sites, allied squad aggregates, last-known enemy positions; no individual animation inside overview.
- Optional developer overlay (query ?debug=1): logical cell (x,y), floorLevel, ramp edges, coverMask, LOS ray, FPS, sim step p95, nav queue, active unit count, blocked squad count, rendered unit count.

No design-system framework, shop/menu, accounts, custom animation library or mandatory audio for core implementation.

## 9. Rendering and scalable map size

### 9.1 Reuse by contract, not wholesale copying

Reference engineering:
- src/model.mjs for 2.5D projection and Board invariants
- src/navigation.mjs for shared distance fields, bounded incremental search, occupancy/reservations
- src/spatial-index.mjs for localized unit lookup
- src/render.mjs and src/character-render-cache.mjs for visible-unit culling and pose caches
- src/terrain-render.mjs for viewport-sized terrain cache

Source repository: https://github.com/jaksim0sec/FlowerWars-MINI

**Do not import FlowerWars-MINI's entire FlagMatch/Combat state directly.** AshenFront uses new floor topology, cover and objective rules. Source repo remains unchanged; copy only reviewed compatible utilities. Confirm legal provenance of any third-party assets/dependencies before copying them.

### 9.2 Render pipeline

1. Static terrain/covers/height faces into a **viewport-sized padded terrain cache**; do not allocate one huge canvas covering entire 256×192 map.
2. Only dirty terrain portions need rebuilding where possible. P0 may rebuild bounded viewport cache on terrainRevision; P1 may add chunk-level dirty bounds if measurements show a need.
3. Query visible spatial buckets before drawing characters; reject offscreen soldiers before per-part animation.
4. Sort visible sprites by projected feet/depth, stable ID tie-break. Split front-facing trench walls into a foreground overlay as needed.
5. Combat event sprites use capped pools and never participate in game-state correctness.
6. Minimal zoom → cached unified soldier sprite; greater zoom → existing character rig/piece layers (deferred after P0). Candidate ranges: <0.50 simple sprites, 0.50–0.99 cached composite, >=1.00 detailed rig.
7. No render process reads or modifies random seed/state of authoritative combat.
8. Stationary empty view should not continuously rebuild terrain cache.

### 9.3 Size increase: conditional, not automatic

| Stage | Map | Soldiers | Gate |
|---|---|---|---|
| P0 | 64×48 | 40v40 | all core rules correct |
| P1a | 128×96 | 90v90 | deterministic long-run + device frame test |
| P1b | 256×192 | 180v180 | nav/renderer evidence remains within thresholds |
| Future candidate | >=256×192 | up to 350v350 | separate performance/design approval |

256×192 = **49,152 cells** and about **2.18×** the 176×128 FlowerWars-MINI map area; it does NOT imply 2.18× frame cost if viewport culling works. CPU navigation, memory, objective AI, and actor count still require independent measurements.

The existing FlowerWars renderer already caches terrain by viewport, culls units and has tested 700-unit simulation timings, but actual mobile prolonged FPS and dense movement completion have not been universally validated. Treat those results as baselines, not guarantees.

**Scale architecture:** Keep core tile arrays and visible viewport cache. Introduce 32×32 *logical* chunks only if required for terrain invalidation or navigation planning, not 48 permanently allocated full-resolution chunk textures. A future sector-level route graph is justified only if destination-field rebuilding on large maps becomes measurable. Avoid writing hierarchical A* before evidence.

### 9.4 Performance/QA targets (acceptance targets, not claims)

- P0 40v40: main-thread responsive, no >100ms repeated long tasks during ordinary play, consistent 20Hz progression.
- P1b 180v180: target sustained >=30FPS on supported Android reference device and no repeated >50ms game-related frame tasks during typical fighting (instrument separately from render/compositor time).
- Simulation step p95 <=8ms on target hardware is an **aspiration**, not current measured output.
- Command acknowledgment UI <=100ms p95 excluding genuine network delays (P1 is offline).
- Zero duplicate occupancy, illegal transition, invalid team order, and deterministic replay divergence.
- Never reduce game tick quality by hiding permanent order stalls or skipping blocked actors. Test both low zoom and close zoom with concurrent events.
- Profile at least 20-minute matches for memory drift when P1b is enabled.

## 10. P1 expansion only after P0 green

P1 adds:
1. Three objective zones (north/center/south), with a clearly parameterized win rule: control >=2 zones continuously for 75s, or highest objective score at **20 minutes**, draw on equality.
2. Single limited **area support** command as a game mechanic: team starts with 2 uses, each additional use requires 60s cooldown; validate selected area in owned/visible tactical bounds per game's abstract rules. Apply effects as a one-shot radius-3 **simulation event** (e.g., +15 target-squad suppression, -10 affected coverCondition, and simple fixed HP change capped by game balance); do **not** spawn physically simulated shells or use real-world artillery calculation.
3. Reserve/respawn **excluded** initially. All initial squads pre-place. A finite battle should work without ongoing recruitment.
4. Three sectors, each with walkable H0 trench systems and sparse H2 ridge sections; configurable goal/cover labels.
5. Expanded enemy state based on objective priority only, not a deep strategy tree.
6. Performance optimization guided by P1a/P1b measurements.

**Potential future systems (separate approval):** trenches constructed in match, supply trains, MG/medic/engineer roles, morale, named commanders, vehicles, aircraft, PvP and persistent campaign. None are required to ship the core.

## 11. Suggested repo structure and modules

Create modules as each phase needs them. The structure below is a destination, **not an instruction to generate unused placeholders**.

~~~text
AshenFront/
├── index.html
├── package.json              # Node 22 test scripts
├── README.md
├── docs/
│   └── CORE_GAME_IMPLEMENTATION.md
├── src/
│   ├── main.mjs               # app bootstrap, renderer + sim wiring
│   ├── sim/
│   │   ├── world.mjs          # cells/arrays/height, deterministic seed
│   │   ├── engine.mjs         # fixed tick and event ordering
│   │   ├── commands.mjs       # validate/select orders
│   │   ├── navigation.mjs     # shared BFS, reservations and arrivals
│   │   ├── combat.mjs         # LOS, cover, shot events, HP
│   │   ├── squads.mjs         # 10-member squads, suppression
│   │   ├── objectives.mjs     # control and end-of-match
│   │   └── bot.mjs            # simple deterministic opponent
│   ├── render/
│   │   ├── terrain.mjs        # height faces and cache
│   │   └── scene.mjs          # characters/selection/effects
│   └── ui/
│       └── controls.mjs       # mobile orders, camera, HUD
└── tests/
    ├── height.test.mjs
    ├── navigation.test.mjs
    ├── combat.test.mjs
    ├── objective.test.mjs
    ├── bot.test.mjs
    └── browser.py             # if Playwright/Chromium environment available
~~~

No mandatory build/bundler for MVP. Static local server over http://localhost is enough; no file:// ES-module preview. Keep character art independent of sim code. Do not copy old FlowerWars app UI wholesale.

### Simulation tick order (explicit)

~~~js
function simulationTick(state, inputCommands) {
  applyValidatedCommands(state, inputCommands); // ordered by tick, clientSeq
  advanceActiveMovements(state);                // complete reserved steps
  updatePendingSquadPaths(state);               // staggered, bounded
  proposeAndReserveNextSteps(state);             // deterministic collision rules
  resolveFireEvents(state);                     // LOS, hits, cover, suppression
  removeDefeatedActorsAndReleaseCells(state);
  recoverSuppressionIfEligible(state);
  updateObjectiveProgress(state);
  maybeRunBotDecisions(state);                  // queues next-tick orders
  finalizeWinnerAndClock(state);
  state.tick++;
}
~~~

A bot decision is applied **next** tick, not in the middle of another unit's damage event. Snapshot ordering and reference cleanup must be deterministic. If a soldier is removed during active movement, free both current occupancy and pending reservation; avoid permanent ghost reservations.

### Contract between sim and view

~~~ts
type RenderFrame = {
  tick: number;
  units: Array<{ id: number; team: TeamId; x: number; y: number; px: number; py: number; alive: boolean }>;
  changedTerrainCells: number[];
  objectives: Array<{ id: number; owner: TeamId | null; contested: boolean; progress: number }>;
  events: Array<{ kind: "shot" | "impact" | "capture"; x: number; y: number; eventId: number }>;
};
~~~

RenderFrame can initially be built directly on main thread; change-only snapshots/transfer buffers become relevant only if profiling shows a bottleneck. Do not deep-clone the entire world each frame.

## 12. Implementation order, narrow acceptance tests

### Phase A — World + height (AF-01)

Build terrain arrays, projection/inverse picking, static map fixture, 3 visual elevations, explicit ramp edges and occluding earth sides.

Tests:
- Every cell only has H0/H1/H2; height-2 jump never traversable.
- Ramp 0↔1 and 1↔2 traversable only at authored connections, both directions.
- Touch picking near trench and ridge returns intended visible cell under multiple zoom/pan values.
- Trench front rim covers lower character portion; unit feet match surface.
- At least two route exits from each side's trench fixture.

### Phase B — Movement and commands (AF-02)

Build unit IDs, squad selection, MOVE/HOLD/RALLY, shared BFS and occupancy/reservation. One persistent move order, simple colored shapes.

Tests:
- 10-unit squad travels across authored ramps without duplicates.
- Two opposing groups cannot claim one tile simultaneously.
- Multiple allied groups cross a two-cell passage without indefinite wait on a valid route; report and fix any starvation.
- New move command overrides prior goal but preserves already committed half-step.
- No route never becomes infinite search; status shows no_route.

### Phase C — Combat + suppression (AF-03, AF-04)

Add fire timer, spatial target lookup, line-of-sight, directional cover, HP, elimination and squad suppression.

Tests:
- Same distance/seed/cover produce exactly same hit sequence and winner.
- A ridge interrupts equivalent H1 line as authored; LOS through allowed trench firing positions is not accidentally universally blocked.
- Attacker direction changes cover outcome.
- Suppressed group pauses/recover/resumes its retained valid MOVE goal; HOLD still works.
- Dead actor has no occupied or reserved tiles.

### Phase D — Complete P0 match (AF-05, AF-06)

Add one capture objective, 8-minute cap, visible HUD and low-cost bot.

Tests:
- 45s uninterrupted hold wins; contest freezes; switching contender resets progress; draw possible.
- 20 deterministic bot-vs-bot trials must show objective competition and movement, with logged idle reasons.
- User can finish a match end-to-end on mobile-size browser with no JS page error.

### Phase E — Artillery abstraction and scaling (AF-07, AF-08)

Only after P0 functional. Add simple support event, 3 objectives, scale 128×96 then 256×192, 90v90 then 180v180.

Tests:
- Support use count/cooldown enforced; area events process once; effect changes do not modify map elevation/connectivity.
- Initial stage can run with exact same rules and no full client/server infrastructure.
- Perform fixed-seed 10-minute and 20-minute simulations, compare p95/p99 tick, draw, actor queries, candidate LOS checks, nav expansions, memory use, stalled orders and capture stats.
- Abort escalation if core rules regress or target device degrades; do not quietly lower intended gameplay requirements.

### Phase F — Minimal polish (AF-09, AF-10)

Add height-aware sprites/rigs only where helpful, outline teams, compact tactical overview, zoom constraints, optional ambient effects. Assert UI does not leak into simulation.

Tests:
- 390×844 and desktop 1280×800 at DPR1/2, zoom+pan+select+move.
- No obscured buttons, wrong-height picks, overflowing panels, missing textures.
- With identical recorded commands and seed, output checksums remain identical with 15, 30, and 60FPS rendering.
- Verify actual physical Android device before claiming mobile performance.

## 13. Evidence and reporting requirements

Each phase completion report must contain:
1. ID and pass/fail, with commit SHA and exact branch.
2. Code changes kept within phase scope and anything intentionally omitted.
3. Tests executed, numbers passed/failed, including previously existing failures if any.
4. Benchmark conditions (device/OS/browser, map size, actor count, seed, simulated duration) and p95/p99 results when relevant.
5. Repro steps for visible issues; no fabricated claims of physical-phone or live-network testing.
6. Next phase must not begin if a blocking issue remains without an explicit documented decision.

The game can look rough in P0. The only legitimate reason to stop for visuals is when a necessary mechanical state (height, cover, target selection, suppression, ownership) cannot be read on screen. Art direction must not become a prerequisite for simulation.

## 14. Key design decisions / no surprise scope changes

- **Three standing elevations are adopted**: H0 trench, H1 ground, H2 raised terrain. No stacked layers.
- Elevation must work in **navigation, visibility, picking, and occlusion** from the first prototype; a purely cosmetic Z offset does not satisfy the requirement.
- **Only one basic soldier type** in P0; no nation-specific equipment balancing, realistic gun behaviors, or elaborate injury/morale states.
- **Suppression is squad-level**; health remains soldier-level. Cover is positional, not a personal armor stat.
- **Objective control replaces flag destruction**. First objective in P0, three in P1.
- **Limited support is a world event**, not a physically simulated artillery unit.
- **Fixed 20Hz sim + viewport rendering**; optimization must be measured rather than speculative.
- **No changes to FlowerWars-MINI**. Reuse carefully reviewed compatible code only.
- **AshenFront main contains this design document only at this step**. This task does not authorize implementing the game, creating extra branches, or generating large art packs.

## 15. First actionable development brief

Implement Phase A only:
1. Static Vite-free page serving a deterministic 64×48 field with three real floor levels.
2. Terrain arrays and explicit 0↔1/1↔2 ramp connections, blocked edges, directional cover-mask visualization.
3. Canvas isometric renderer with height-dependent tile faces, correctly occluded simple soldier silhouettes, camera pan/zoom and height-correct pointer picking.
4. Headless tests validating transitions, connectivity, floor association and reversible projection/picking for test fixtures.
5. Keep code limited; do not add combat, new factions, audio, detailed UI or online until Phase A passes.

After Phase A is tested, proceed to Phase B under the gates above. Do not conflate the design's full list of future phases with immediate authorization to implement them.
