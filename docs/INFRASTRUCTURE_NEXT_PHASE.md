# AshenFront · Infrastructure & Battlefield Direction — Codex Implementation Contract

> Status: NEXT DEVELOPMENT SPECIFICATION (not implemented by this document)
> Date: 2026-10-29 (Asia/Seoul)
> Target: `jaksim0sec/AshenFront`, existing `main`
> Reference: `jaksim0sec/FlowerWars-MINI` — compare relevant patterns only, not a wholesale port.
> Existing contracts: `docs/CORE_GAME_IMPLEMENTATION.md`, `docs/IMPLEMENTATION_REPORT.md`
> Priority: reliable commands and movement > sustainable battle architecture > meaningful warfare > mobile-first presentation > optional polish.

## 0. Mission and operating rules

Turn the working AshenFront prototype into a reliable foundation for a **fictional early-industrial / WWI-era, trench-centered, 2.5D isometric RTS**. The player should command formations and hold, breach, withdraw from, and retake lines, rather than race an arbitrary capture timer. Make the battlefield the main visual element, not large dashboard boxes.

**Execute in stages with tests; do not merely produce another plan.** Inspect the actual current repository before editing, read any AGENTS.md if added, run the existing checks as baseline, and preserve working behavior. Do not create a new branch, do not touch FlowerWars-MINI, and do not claim that cloud-browser testing proves physical-device performance. Commit verified increments to the existing branch. Do not silently add backend, PvP, ECS, extensive asset pipelines, recruitment economies, save/cloud services, or other unrelated systems.

This specification supersedes ONLY the earlier match-victory and UI expectations where explicitly stated. Keep the existing three elevations (H0 trench, H1 field, H2 ridge), 20Hz deterministic simulation, basic ranged fire, directional cover, suppression, and limited support as the starting core.

## 1. Verified baseline and concrete defects to investigate

At inspection (AshenFront `084923097df6804b6d6138b903187f5035fa4a8d`), the repository includes `src/sim/{navigation,commands,state,world,objectives,bot,engine}.mjs`, `src/render/{terrain,scene,projection}.mjs`, `src/ui/controls.mjs`, and Node/Chromium tests. The previous report states 32 passing Node cases and cloud Chromium checks, but the player reports **orders not moving exactly/reliably**. Passing unit tests do not invalidate that user-observed problem.

Inspect these specific mismatches before replacing algorithms:

1. `command(...type:'move'...)` defaults to `radius:3`, whereas a tap looks like an exact destination. `Navigation.field` treats all reachable same-elevation tiles inside the radius as equivalent. Arriving several tiles away can therefore be 'correct' to the code but wrong to the player.
2. `s.reached` becomes true at **80% of living soldiers**. That can disguise two stuck soldiers in a ten-member squad. Distinguish fully arrived, partially arrived, temporarily blocked, and unreachable.
3. There is no persistent formation/individual landing-slot allocation. Multiple soldiers reduce the same distance field, creating collisions/congestion and arbitrary clumping.
4. Dynamic detours start after waiting at least 40 simulation ticks; cooperative vacancy movement is specialized to **same-team squads sharing exactly the same goal/radius**, while an ally holding a crossing can obstruct unrelated commands.
5. A command can return `{ok:true}` after only syntactic validation and flow-field creation, even if the eventual route is impossible. Acknowledgment must not masquerade as guaranteed delivery.
6. The UI reports coarse status; there is no persistent target/route/landing preview with clear evidence that the correct tile and elevation were selected. `pickTile`, sprite hit detection, pointer events and the camera transform must be tested together.
7. `TerrainRenderer` includes camera translation in its rebuild key; the cache is regenerated on camera moves. `Scene.draw` constructs a fresh spatial index from all actors every frame. Optimize only after profiling, using the reference game's ideas as appropriate.
8. The current header and footer occupy significant viewport height, while `terrain.mjs`, `scene.mjs`, `style.css` and `Overview.draw` contain green, khaki and brown hardcoded colors.

**Do not assert any one of the above is the sole root cause.** Reproduce with deterministic simulations AND actual pointer-driven browser scenarios. Trace accepted order -> resolved clicked cell/elevation -> planned formation slots -> reservations -> per-member progress -> UI completion.

## 2. Selective FlowerWars-MINI reference matrix

Inspect FlowerWars-MINI `main` at or after `0d4e7a513c6fe02ab864fb6335792bd9d2280312`; source may change, so check existing files/semantics before using. These are architectural references, not drop-in modules.

| Reference | What to learn/adapt | What NOT to import |
|---|---|---|
| `src/navigation.mjs` | Shared bounded distance fields, cooperative movement/reservations, occupancy-aware detours, field/route cache limits, congestion telemetry, safe order replacement | Its melee-target logic, arbitrary Board structures, legacy fixes, or a blind 35k-character replacement |
| `src/spatial-index.mjs` | Persistent per-cell/bucket membership, update on movement/death, querying only changing neighborhoods | FlowerWars-specific unit interfaces or snapshot assumptions |
| `src/terrain-render.mjs` | Padded viewport-sized terrain cache, stable static scenery, culling and invalidation keyed to terrain changes | Grass/pond artwork, incorrect flat-height assumptions, full autumn environment |
| `src/render.mjs` and character render helpers | Visible-only unit drawing, simple low-zoom unit LOD, separating static terrain from dynamic entities | Flower-themed characters, melee animations and equipment rigs |
| `tests/command-reliability.test.mjs`, `tests/cooperative-navigation.test.mjs`, `tests/march-vacancy-relay.test.mjs` | Regression scenario design: repeated orders, cancel/retreat, opposing friendly traffic, blocked corridors, idempotence, no phantom reservations | Their expected stats/game balance or unrelated combat abilities |
| `docs/autumn-battlefield.md` | Evidence discipline and an explicit warning: wider corridors did NOT fix every large-group arrival case | Unverified claims that a copied navigation technique solves all congestion |

**Domain differences to preserve:** AshenFront is ranged-combat and suppression-first; elevation and trench exits constrain routes; squads need a firing line and cover positions rather than melee swarm engagement. Fire must work from HOLD. Suppression can pause a move while retaining intent. No swords, healing magic, floral units, instant construction of trenches, tanks, aircraft, or historically-specific insignia in this phase.

If adapting an implementation, write a minimal compatible version against AshenFront's typed arrays, 20Hz tick, existing simulation command contracts and deterministic tests. Preserve attribution/provenance where appropriate and check any new third-party code licenses. Prefer independent implementation over copying whole files.

## 3. INF-01 · Orders become precise, observable, reliable

### 3.1 Explicit order model

Keep commands deterministic, serializable, and authoritative. Introduce an immutable command ID/generation for the latest order, and track a separate execution status. Suggested contract:

```js
// Desired conceptual contract; adapt naming to avoid needless migrations.
{
  orderId: 42, squadId: 1, kind: 'move'|'hold'|'rally'|'withdraw',
  targetCell: 1174, targetElevation: 1, placement: 'formation'|'area',
  status: 'planning'|'moving'|'paused_suppressed'|'blocked'|
          'partial'|'arrived'|'unreachable'|'cancelled',
  arrivedCount: 0, livingCount: 10, reason: null
}
```

A click identifies **the formation anchor/intent**, not an arbitrary radius-3 success zone. Provide either (A) explicit user-requested **move-to-position** with precise squad formation placement, or (B) a visibly labeled **move-to-area/rally** with bounded area behavior. They are not interchangeable. A successful API acceptance means the command was recorded, NOT that the path is traversable.

Retargeting immediately replaces the old intent and invalidates old planning/slots; an already committed reservation may finish safely. HOLD stops creating new movement reservations; a previously reserved step can finish. Repeating the same command is idempotent. Do not silently restore obsolete waypoints after command replacement, death, suppression or a newly issued order.

### 3.2 Formation landing-slot allocation

For a ten-member infantry squad, choose a small **contiguous or near-contiguous line / staggered two-rank formation** aligned to intended advance or local trench orientation. Prefer the simplest deterministic geometry feasible on the tile grid. The clicked anchor is central and meaningful.

- Before pathfinding, enumerate viable cells near the anchor: unblocked, reachable through legal ramps, not permanently occupied by enemies/noncooperative holders, compatible with the required elevation; consider trench cover and LOS when the stance is HOLD/defend.
- Allocate **distinct** slots to living soldiers, preserving stable assignment across ticks when possible. No duplicate targets. Do not place actors on impassable walls or illegal height jumps.
- If space is insufficient, visibly report `partial / insufficient room` or `unreachable`; don't secretly widen the destination indefinitely. A bounded fallback area is allowed only if the UI previews and explains it.
- A completed movement order means **all reachable, living, assigned members** have settled into their confirmed slots. If some members remain blocked, show the exact fraction and cause; do not call 8/10 a fully completed ten-member move.
- Units should automatically face/shoot according to existing ranged rules; formation positioning must not disable auto fire, cover or suppression.

This is an infrastructure feature, not a requirement for historically accurate ranks, complex military formations, individual collision physics or micro-animations.

### 3.3 Navigation under congestion

Preserve one legal floor per (x,y), 4-neighbor movement, H0/H1/H2 ramps, existing one-step reservations and atomic occupancy invariants.

- Prefer shared static distance-field or waypoint planning per **destination/region/group**, not repeated full-map A* per soldier.
- Cap outstanding field count, memory and search budget. Include terrain/topology revision in invalidation; changing visibility/cover without changing traversability should not flush every route.
- Use deterministic traffic priorities and small local detours for dynamic obstruction. Support safe **same-team** vacancy chains/cooperation between squads **with different destinations** when possible; do not displace enemies, HOLD orders, stationary defensive positions, or suppressed squads.
- Avoid repeated rerouting loops at a sealed bottleneck; provide a stable `no_route`, `blocked_by_ally`, `waiting_for_capacity`, `suppressed` or `planning` state and recovery only on a relevant change.
- Preserve directionality and reciprocal ramps, deterministic tick budget, movement interpolation and the combat/LOS separation.
- Prevent distant squads from monopolizing a two-tile exit, and do not let an arrived squad block the only traversable entrance to a destination region if a legal alternate slot exists.

### 3.4 Input and user feedback

At selection, show a thin selection ring/outline and the selected formation. On ordering, temporarily show: resolved floor-tile indicator, H level, ghost formation/landing slots, and a restrained path line or progress marker. Give immediate visible acknowledgment and later truthful status. Retain target indicator until completion/cancellation; do not silently discard it.

Respect pointer vs drag vs pinch: no accidental orders during camera operations. Test low zoom, zoom 1.6, moving actors, wall-face picking, H0 behind raised soil, screen edges, mobile DPR, and camera move before tap. The tile visual feedback must match the cell received by `command`.

### 3.5 Acceptance tests (mandatory)

1. Flat 10-person squad to an exact anchor: unique legal destinations, all arrive or explicit partial/unreachable.
2. Several sequential destinations: only latest order takes effect, none later revert.
3. Same destination repeated: stable path and no unnecessary replan.
4. H1->H0->H1 and H1->H2->H1 via only legal ramps; impossible jump gets a precise failure state.
5. Two ally squads moving opposite directions through two-wide and four-wide passages; zero collisions; bounded, measured completion for feasible scenarios.
6. Four ally squads approaching nearby but distinct positions; no concealed 80% completion.
7. HOLD ally and suppressed ally remain in place without forced displacement; live traffic either routes around or returns truthful blocked state.
8. Unit death while reserved; no ghost occupancy/reservation.
9. Browser tap on a moving soldier and an H0 floor near a vertical wall; selected/destination cells match rendering.
10. Verify route-budget ceiling, deterministic checksum and a finished combat match after navigation changes.

Capture event logs (orderId, squadId, state transitions, targetCell, arrived/live, wait reason, active route/field counts) only under debug/telemetry mode; no per-unit console spam in production.

**Stop gate:** INF-01 is incomplete until the player can reliably send orders and inspect why a squad did or did not move. No AI/art overhaul before this gate.

## 4. INF-02 · Stable engine contracts and battlefield model

Keep the current ES-module + Canvas 2D implementation. No wholesale ECS rewrite or server migration.

Use existing `src/sim` modules as authoritative state. Enforce responsibilities:

| Layer | Owner |
|---|---|
| World | Cell terrain and height, blocked edges, ramp adjacency, cover, structure/sector locations, geometry revisions |
| Orders | Validation, latest-order generation, ownership, explicit progress/result |
| Navigation | Group destination allocation, shared routing, occupancy/reservation, congestion resolution |
| Combat | LOS, range, shots, cover effects, suppression-triggered state transitions |
| Tactical scenario | Command posts, strategic sectors, match-end rules, selected bot policy |
| Bot | Issues the same validated commands as humans, using legitimately visible facts |
| View | Camera projection, terrain cache, actors, ghost destinations and temporary combat effects |
| UI | Pointer interpretation, selected entity, compact contextual controls; never calculates authoritative combat |

Only add files when code/function boundaries justify them. Avoid parallel 'new engine' scaffolds and dual sources of truth.

Maintain 20Hz fixed simulation, seeded RNG independent from render randomness, reproducible command log, distinct authoritative model and interpolation-only view, and existing debug/replay support. Preserve existing 64x48 default scenario as a reliable test fixture while extending scenario definitions. Future 128x96 and 256x192 boards should continue using the same underlying world/simulation interfaces, not a separate game implementation.

**Map data contract:** explicit terrain layer, height, ramp connection, blocked/edge flags, directional cover and named structure/sector entities. Separate visual texture selection from traversability: changing a gray tile's paint must never accidentally change the route graph.

## 5. INF-03 · Replace the minigame victory timer with meaningful warfare

**Agreed gameplay direction:** no default match time limit; a sector is valuable because of position, cover and support access, not because a floating timer reaches 45/75 seconds. Keep a displayed **elapsed battle clock** only.

### Playable new default scenario

- Two defended, visible command posts (one for each faction) located in rear territory; at least two feasible approaches and enough navigable room around each. Do not overlap unit spawns or ramps.
- Primary objective: **seize the enemy command post** after removing defenders from its defined capture perimeter. Capture is resolved from authoritative current occupancy; no arbitrary timed hold to win. A post is contested while enemy defenders remain in the defined perimeter.
- Secondary end condition: enemy has no combat-capable units (or no remaining means to contest a command post) -> victory. Simultaneous terminal conditions -> deterministic draw rule. No hidden 'end at minute 8/20' fallback.
- A central trench and north/south high-ground sectors remain **strategic locations**, offering positional advantage and limited support validity, but are NOT victory timers. Sector ownership may persist or become neutral on a clear documented rule; do not mix UI countdowns with ownership.
- Player can choose frontal fire, hold/defense, lateral advance, rear approach, and tactical withdrawal; orders are not auto-forced toward central sector.
- Ensure both command posts are reachable on each initial scenario, and AI guards home territory instead of evacuating everything to a single point.

**No feature inflation:** first implement this with existing 40v40 basic rifles, cover, suppression, simple support, no free reinforcements, inventory, supplies, construction, mortar physics, assault mechanics, squads of 50, or campaign. Avoid claiming this is yet a full strategic war simulation.

### Bot minimum behavior

Use a small state machine with deterministic staggered reevaluation and cooldown:

1. Guard own HQ with a minimum defensive reserve.
2. Hold tactically useful trench/high ground where it protects the approach.
3. Advance only with uncommitted squads and clear navigable routes.
4. Respond to a visible HQ threat or losing defended sector by redirecting an available squad.
5. Retarget/withdraw blocked or suppressed groups without oscillating every tick.

No global knowledge of hidden opposing troops; no magical teleport or hidden supplies. Strategic competence is measured by bot-vs-bot matches, whether it leaves HQ undefended, and whether it can complete legal movement orders. Do not import FlowerWars' castle/flag destruction rules.

**Regression tests:** wins by HQ capture, elimination, simultaneous events; does not end on elapsed time; neutral sector alone cannot win; defending units contest enemy HQ; bot can defend while another squad advances; old objective UI, end screen, support validity and scenario fixtures do not throw.

## 6. INF-04 · Battlefield-first, near-monochrome UI

The current 80–88px header plus permanent footer of squad tabs, commands, pressure and status hides too much battlefield on mobile. Replace their *layout*, not the underlying command system.

- **Canvas fills the viewport** including top/bottom safe areas; all HUD elements overlay it. Aim for >=85% of screen area visibly unobstructed in normal non-selection mode, measured on 390x844 DPR1/2. No permanent giant header/footer.
- **Top:** a minimal 24–36px status strip with faction, surviving numbers, elapsed time and pause; no decorative logo block.
- **Selection-dependent lower context:** small selected-squad name, living/total count, suppression state and 3–4 commands (move, hold, rally/withdraw, support where applicable). Compact 44px+ touch targets; hide when no squad selected.
- **Minimap:** collapsed by default on narrow screens, expandable or toggleable near a corner; must not permanently cover the fight.
- Hide terrain legend and verbose help/status outside tutorial/debug; display short transient notification for blocked/unreachable/accepted orders. The tactical scene must convey cover and levels without a permanent explanatory box.
- Retain quick keyboard shortcuts on desktop; preserve wheel/pinch/drag and pointer capture logic. Selection, command, confirmation and cancellation must remain usable with one hand on mobile.
- No glass-heavy dashboard, oversized rounded cards, emoji toolbar, floating paragraph overlays or design that resembles a mobile casual-game menu.

### Near-monochrome palette

Use design tokens shared by CSS and Canvas renderer (constants module or explicit palette registry, not a large design system). Example *starting* colors, tune after actual rendered captures:

| Element | Proposed color |
|---|---|
| Deep trench / occluded soil | `#292D30` |
| Crater / heavy shadow | `#1D2022` |
| H1 ash-gray ground | `#686D70` |
| H2 ridge highlights | `#909498` |
| Concrete / stone / debris | `#4B5054` |
| Edge light / important text | `#D1D4D5` |
| Arken units: charcoal uniform with blue-gray read | `#879EAD` accent |
| Velian units: washed-out rust-gray read | `#A27D7D` accent |

**Terrain should be predominantly neutral gray**, not green/khaki/yellow soil. Natural patches may be slightly warm/cool in restrained amounts; never form large repeated bright olive fields. Use brightness, edge contrast, shadows and trench lip shapes to clarify H0/H1/H2. Keep faction colors on unit markers and meaningful cues, not wide tinted terrain panels. Check contrast for color-vision differences and near-monochrome screenshots.

Characters should preserve the approachable small **faceless**, simple FlowerWars-sized silhouette language while becoming distinct early-industrial soldiers: compact head with cap/helmet, small angular coat, dark limbs, restrained rifle silhouette. An officer can get a sharper cap/longer dark coat eventually; NO human faces, hair, anime proportions, highly realistic anatomical soldiers, flower uniforms, or entire detailed 3D figurines. Do not spend the infrastructure phase generating dozens of art assets or implementing a full skeletal rig. Draw concise Canvas placeholder soldiers now, with clean sprite/LOD interface for later art.

## 7. INF-05 · Render and content infrastructure

Performance work should be evidence-driven. Keep DOM UI and Canvas 2D scene separated.

- Static terrain render: adopt the useful **padded viewport cache** concept from FlowerWars, so slight pans re-use a cached larger view; recompute only when the viewport leaves cache coverage, zoom changes materially, world visual revision changes or display/DPR changes. Never allocate a massive full-world texture at 256x192.
- Split static terrain, sparse static props/decals and dynamic soldiers/markers/effects. Correct depth ordering and front soil lips must still occlude H0 soldiers.
- Add deterministic, sparse, neutral-gray patches/decals and a small number of crater/debris shapes. Low repetition without per-tile randomized runtime allocations. Keep gameplay terrain heights/topology separate from appearance.
- Query visible units with an index retained/updated when actors move or die if profiling shows repeated per-frame rebuilding is material. Source positions and active destinations may both need index membership; view interpolation is not authoritative movement.
- Unit LOD: simple distant soldier or direction marker at low zoom, complete silhouette near zoom, suppress optional effects in low-power mode. Preserve selection and faction recognizability at zoom 0.3.
- Cap rendered active effects, cache sizes and static decoration count. Smoke and artillery are optional short bounded effects, not full-screen fog or runtime particle storms.
- Keep `?debug=1` instrumentation for terrain cache builds, visible/rendered actors, sim/render p95, route budgets, outstanding commands, stuck duration and browser long tasks. Do not show debug telemetry by default.

**Height correctness first:** H0/H1/H2 pick/render/LOS/ramps must remain consistent when changing visuals. Do not solve height readability by raising sprites without updating correct occlusion/picking geometry.

## 8. Development gates and verification matrix

Do this work in small verified commits, not one enormous rewrite. Each gate includes executable code and tests. The tests are not a license to ignore the actual player's issue.

| Gate | Work | Required evidence |
|---|---|---|
| G0 baseline | Run existing tests, capture current browser HUD and 3 user-like movement scenarios; log suspected command/arrival mismatch | Current commit, test results, screenshots/logs; clearly distinguish existing vs newly found failures |
| G1 navigation reliability (INF-01) | Order status, exact/area semantics, formation slots, cooperative collision/route fixes, correct pointer feedback | New deterministic tests + true browser touches; all prior checks preserved; no collisions/infinite false success |
| G2 stable game architecture (INF-02) | Clarify state ownership, scenario data and revisions, eliminate demonstrated duplicated logic only | Repeatable checksums and unchanged LOS/cover/suppression/damage invariants |
| G3 war scenario (INF-03) | No artificial victory clock, two guarded HQs, meaningful central sectors, small defensive/advancing bot | Automated victory/contested/defense tests and multiple seeded complete matches |
| G4 presentation (INF-04/05) | Full-screen overlay HUD, near-monochrome terrain, faceless soldier silhouettes, cached scenery, LOD | Real Chromium screenshots at 390x844 and 1280x800, DPR1/2; touch controls + legibility + cache assertions |
| G5 scale validation | Repeat at 64x48/40v40, 128x96/90v90, 256x192/180v180 **debug fixtures** | CPU p95/p99, renderer p95/p99, navigation expansions, arrivals/stalls, live actors, cache bytes; explicit devices/conditions |

**Movement scenarios:** at least 20 deterministic seeds and one repeated retarget under active combat; four squads crossing a shared choke; an adversarial opposing-squad crossing; HOLD and suppression at the ramp; enemy-occupied corridor; unit killed while reserved; impossible anchor; edge target; full camera pan/zoom between selection and command. Validate completion fractions, latest order ID, invariants and bounded planning.

**No regression:** existing 32 Node cases and Chromium interaction suite must still pass unless explicit old match rules are intentionally superseded; update those tests with equivalent or stronger assertions, never delete to make a report green. Maintain 15/30/60 render-rate deterministic replay checks. Manually inspect actual before/after screenshots, not generated concepts.

**Scale safety:** the default player mode remains the largest proven stable configuration. Large debug fixtures are NOT automatically released because headless desktop numbers are small. Physical phone performance, sustained battles/heat and dense navigation are separately reported as unverified if not actually tested. If a target fails, preserve stable smaller mode and explain the blocker.

## 9. Implementation guidance / anti-patterns

- Read and reuse existing source; do not start a parallel app under `new/`, copy the whole FlowerWars engine, or create speculative abstractions.
- Do not claim 'movement fixed' because occupancy invariants pass while players still experience unresponsive orders, stale targets or 8/10 silently marked complete.
- Do not remove combat to make movement benchmarks look better; profile with real LOS/shots/suppression.
- Do not enable physical terrain deformation or force a new graph rebuild every shot; cover damage and topology change must remain distinct.
- No new branch unless explicitly authorized. Current repo history should remain reviewable via scoped commits.
- Do not replace current gray-war concept with bright green, khaki, brown terrain or excessive boxed UI.
- Do not hide unresolved congestion via teleportation, unit stacking, huge destination radius or arbitrary timeouts.
- No final response consisting of unverified 'ready' claims. Report precisely what is shipped.

## 10. Required final developer report

Return in this order:

1. Exact branch/head and commit(s), including any concurrent-baseline changes.
2. Changes implemented per INF-ID and gate; user-visible behavior, not only file list.
3. **Movement:** old reproducible issue, root cause(s) confirmed, fix, exact route/arrival test outcomes, remaining failure fixtures.
4. **Game loop:** exact victory/end conditions and strategic sector effects.
5. **UI:** real browser before/after screenshots or paths with viewport/DPR and what is/isn't final art.
6. **Performance:** measured environment, scenarios, p95/p99, maximums, counters, and honest physical-device limitations.
7. Commands to run locally, tests passed/failed, and remaining actionable blockers.

**Start at G0; prioritize G1. Continue autonomously through further gates when feasible and safe. The goal is a playable, reliable tactical war-game foundation, not a pile of architecture documents.**
