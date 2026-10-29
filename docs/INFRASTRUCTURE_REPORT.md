# Infrastructure next phase — developer report

## 1. Branch and commits

Branch `main`. Concurrent baseline update: fetched and fast-forwarded from0849230 to65eb56021f740b879cd3590dfd34cf4cd6680070, which added the requested contract only. No AGENTS.md was present. No new branches or worktrees were created.

- `0fa7c6b`: INF-01 precise formation orders, progress and cooperation.
- `dec0b76`: INF-02/03 scenario contracts and untimed defended HQ gameplay.
- `30edd7b`: INF-04/05 full-screen gray battlefield, cache/index and review fixes.
- `2c76720`: actual central trench and strategic centers on real H0/H2 terrain.
- A final documentation/evidence commit follows these implementation commits. Exact final checkout SHA: `git rev-parse HEAD`; `artifacts/infra/final.json` records it after commit. Changes are pushed to the existing GitHub main.

## 2. Shipped behavior by INF-ID and gate

**G0:** Original Node suite32/32 passes. The original checkout was also archived into `/tmp/ashen-infra-before` and served on8001 for actual old Chromium interactions and before captures. First browser attempts failed because the earlier task's server was no longer running; after starting explicit servers, baseline and new interaction checks passed. This infrastructure failure was not described as a game failure. Three baseline order fixtures are recorded in `infrastructure-evidence/g0-orders.json`.

**G1 / INF-01:** MOVE means a precise bounded two-rank formation around the anchor; RALLY is explicitly an area order. Distinct confirmed cells are allocated to living members before route planning. Holders, enemies and other confirmed footprints are excluded. Insufficient space is reported. Order IDs are monotonic; identical commands are idempotent, while target/radius changes invalidate slots, detours and old cooperative intent. Reserved steps can finish. Completion now requires every living member, with arrived/live fractions and cause displayed. Ghost slots, resolved tile/H level and intent line remain visible. HOLD retains fire; withdrawal targets home HQ.

Global reverse fields remain shared. Slot fields are local searches bounded to8 steps, rather than per-soldier full-map A*. Aggregate work remains <=2,048 expansions/tick; current scenario field cache is bounded at96 entries. Retained detours, assignment exchange within the confirmed footprint, and same-team vacancy chains handle congestion between differing active intents. Confirmed stationary formations, HOLD and suppressed allies are protected. Temporary yields resume after their leader clears, dies or changes generation; dependency cycles are broken deterministically. Failed/pending execution is distinct from accepted API input. There is no teleport or hidden widening of the target area.

**G2 / INF-02:** Existing world/order/navigation/combat/view boundaries remain. Visual and topology revisions are distinct. Cover wear does not flush routes; topology changes do. War scenario authors named posts/sectors, central trench geometry and reciprocal exits in the same arrays. The existing64×48 point fixture remains for historical regression checks. The actual application and large debug fixtures select the war scenario explicitly; no second simulation engine exists.

**G3 / INF-03:** Two visible rear HQs, a real two-wide central H0 trench with multiple exits and two real H2 strategic centers. HQ capture is resolved from current living occupancy, contested while defenders remain. Elimination also wins; simultaneous terminal conditions draw. There is no default time cap or sector-hold victory. Displayed time is elapsed time only. Empty sectors retain their last owner; contest freezes ownership. They grant positional cover and valid support targeting, not a countdown victory. The bot retains a home reserve while other squads are available, advances through flank waypoints, responds to visible home threats and uses the same command adapter. If only one squad remains, it may counterattack rather than create two indefinitely idle reserves. This reserve policy is a documented simple tactical choice, not a sophisticated strategic AI.

**G4 / INF-04/05:** Full-viewport Canvas with a32px overlay strip; selection-only contextual controls, collapsed overview, no decorative brand block or permanent legend. Conservative additive overlay measurement leaves91.48% unobstructed at390×844 and94.48% at1280×800, DPR1/2, in normal non-selection mode. Debug panels are intentionally excluded from that normal HUD measurement. Shared CSS/Canvas palette registry uses neutral gray terrain and restrained blue/rust-gray faction markers. Compact faceless capped silhouettes, coat/limbs/rifle at close zoom and distant markers at low zoom. Art is a Canvas placeholder, not final artwork.

A160px padded viewport terrain cache reuses small pans and invalidates on coverage, map identity, zoom, visual revision and display-size changes. It never allocates a whole-world texture. Sparse craters/patches are deterministic static decorations, independent of traversability and combat RNG. The shared transient spatial index is retained until authoritative positions, spawn or death change; interpolation still uses current and pending coordinates. Effects and debug histories stay bounded.

**G5:** Real combat CPU runs and actual rendered fighting samples at64/128/256. Large scenarios remain debug fixtures; these measurements do not enable an unverified physical-phone mode.

## 3. Movement: reproduction, fixes and exact checks

Baseline flat MOVE to(25,15) said reached, while member distances from the clicked anchor were `[3,3,2,3,3,1,3,3,2,2]`; no slots existed. Edge and trench orders likewise used radius3. This established a semantics/feedback mismatch without attributing every movement problem to it.

Further reproduced causes were: early80% success, overlapping unowned destination regions, blocked local detours replacing one another, stale yield dependencies and cross-wall region seeds. Independent review additionally reproduced a settled formation moved by another squad's area relay, and a staggered HQ threat policy that always saw an empty visibility list. Each was fixed with a regression. Region seeds now belong to the anchor's locally connected legal region; a wall cannot create a zero-distance stopping zone on its wrong side. Stale/cyclic yields cannot leave both leaders waiting forever. Area relays cannot displace a settled precise formation. Visibility is queried on the actual eligible squad decision phase.

Final executable checks include:

- Exact ten distinct slots,10/10 arrival within900 ticks; idempotent repetition retains ID and slots.
- Three sequential destinations over20 deterministic seeds: only latest target,10/10 within1,000 final settling ticks.
- Twenty seeded retargets under active rifle fire: latest intent retained, invariants intact.
- H1→H0→H1 and H1→H2→H1 exact formations: all members arrive, legal reciprocal ramps only, within1,800 ticks per leg.
- Two opposite friendly squads through a two-wide passage:10/10 each within1,600 ticks. Four squads through a four-wide shared choke:10/10 each within2,400 ticks. No occupancy or reservation collisions; per-tick work ceiling asserted.
- Four nearby distinct anchors:40/40 within1,800 ticks.
- HOLD and suppressed allies remain at identical cells while traffic routes around,10/10 by1,400 ticks.
- Exact formation behind a wall requiring travel around its distant end:10/10 within3,000 ticks, not idle partial0/10.
- A later rally retains the existing settled formation's10/10 confirmed cells.
- Impossible/insufficient-room anchors, static no-route, hostile occupancy and death during a reserved step preserve truthful states and release cells.
- Actual touch at zoom0.3,1.0 and1.6 after camera focus: H1 cell1561, H0 cell1553, H2 cell478 match the command adapter and latest generation in all four viewport/DPR configurations. Existing moving-soldier, soil-occlusion, drag/pinch and wall-face checks remain.

Passing these controlled fixtures is not a universal completion proof for arbitrary full-capacity crowds. Large simultaneous orders can still be blocked by capacity, defenders or suppression; counts and reasons remain visible. The compatibility point-control bot trial has a deterministic A-side bias in its current20 seeds; label swapping does not establish physical mirror balance. The new war trials are reported separately. Balance is not claimed complete.

## 4. Game loop and strategy

Player mode is64×48 with40 rifle infantry per side. Capture requires an attacker inside enemy HQ's Manhattan-radius4 perimeter and zero living defending actors there. HQ contest, elimination, simultaneous capture/draw, no elapsed-time end, real H0/H2 sectors and staggered visible-threat response are automated cases. No recruitment, supply economy, vehicles or server were added.

Legacy 45/75-second and8/20-minute assertions remain as compatibility scenario tests only. They do not describe the application. `createMatch({scenario:'war'})` selects the current rules; the application/restarts/debug loading use it explicitly. Guard/assault policy uses own squads, public structures/sectors and genuinely visible enemies. Hidden enemy locations are not queried by the policy.

## 5. Actual UI evidence

Before/after and command screenshots are committed under `infrastructure-evidence/screenshots/`, with390×844 and1280×800 at DPR1/2. `before-*` is the archived65eb560 app. `normal-*` is the real new app without debug telemetry. `after-*`/`commands-*` include debug target diagnostics. Screenshots were inspected directly; these are Chromium captures, not generated concepts.

The gray palette, selection-only controls and small soldier silhouettes are implemented. Final military art, physical safe-area/touch validation and color-vision device review remain open. The expanded selection panel is deliberately allowed to cover more area; the>=85% target applies to normal unselected mode. Minimum44px command hit targets remain checked.

## 6. Performance and conditions

Cloud: v24.19.0, linux 6.18.55, INTEL(R) XEON(R) PLATINUM 8573C. Headless Chromium 154.0.8037.57; mobile390×844/DPR2, no CPU throttling. Seed42, real war rules.

| Map / initial actors | Actual simulated seconds / outcome | Tick p95 / p99 / max ms | Final nav fields / bytes |
|---|---|---|---|
| 64×48 / 80 | 151.75 / A | 0.230 / 0.477 / 4.495 | 2 / 49152 |
| 128×96 / 180 | 77.55 / A | 0.448 / 0.844 / 3.055 | 3 / 294912 |
| 256×192 / 360 | 130.50 / B | 0.712 / 0.944 / 3.335 | 4 / 1572864 |

Navigation peak:2,048 expansions/tick at every size; full arrival/wait reasons and combat counters are retained in `infrastructure-evidence/cpu.json`.

| Map | Zoom / low mode | Live actors | Render p95 / p99 ms | Sim p95 / p99 ms | Frame p95 ms | Cache bytes |
|---|---|---:|---|---|---:|---:|
| 64 | 0.3 / False | 61 | 1.00 / 1.60 | 0.40 / 0.50 | 16.70 | 3305760 |
| 64 | 1.0 / False | 61 | 0.80 / 2.40 | 0.40 / 0.60 | 16.80 | 3305760 |
| 64 | 0.3 / True | 60 | 2.00 / 3.80 | 0.30 / 0.50 | 16.80 | 3305760 |
| 128 | 0.3 / False | 146 | 1.80 / 3.60 | 0.80 / 2.10 | 16.70 | 3305760 |
| 128 | 1.0 / False | 146 | 0.60 / 0.80 | 0.50 / 0.60 | 16.70 | 3305760 |
| 128 | 0.3 / True | 146 | 1.20 / 2.60 | 0.50 / 0.60 | 16.80 | 3305760 |
| 256 | 0.3 / False | 336 | 0.90 / 1.10 | 1.20 / 2.30 | 16.70 | 3305760 |
| 256 | 1.0 / False | 335 | 0.60 / 0.80 | 1.50 / 1.70 | 16.80 | 3305760 |
| 256 | 0.3 / True | 332 | 0.90 / 1.60 | 1.60 / 1.80 | 16.80 | 3305760 |

New war20-seed trial outcomes: {'A': 13, 'B': 7, 'draw': 0}; durations65.35–141.40 simulated seconds. These outcomes do not establish balance. Nine browser samples had no page errors; recorded sample long tasks: 0.


CPU profiling preserves real LOS/fire/suppression. Each run ends at its actual outcome or explicit measurement horizon; an early outcome is not described as a ten/twenty-minute battle. Browser profiling uses4 wall seconds after warmup for each size/zoom/low-power combination, camera following a living friendly shooter to avoid empty-view measurements. Buffers reset before sampling. Initial/live/rendered actors, field counts, bytes, arrival states/reasons, navigation expansions, cache bytes, frame timings and long tasks are in the raw JSON.

An earlier close-zoom profile produced an empty final viewport after its fixed camera's shooter moved/died; its assertion failed and that partial run was rejected. The final tracking-view profiles are the retained evidence. No performance improvement is claimed merely because terrain changed; task costs include different battle states. These are cloud CPU/headless Chromium numbers, not physical Android, thermal endurance or prolonged real-time memory proof. Large fixtures remain experimental.

## 7. Reproduction, results and remaining work

```sh
cd /workspace/AshenFront
npm start
# Browse http://localhost:8000
# In another terminal:
npm test
python3 tests/browser.py
python3 tests/infrastructure-browser.py
node tools/infra-benchmark.mjs
npm run bench:browser
```

Node22.8+, no runtime dependencies or bundler. Browser checks require Python Playwright and Chromium (`CHROMIUM_PATH` override supported). Final Node result:51 passed,0 failed,0 skipped, including the previous32 cases. Existing Chromium interaction suite and new infrastructure touch/cache/overlay suite pass four viewport/DPR scenarios each, plus moving-unit and H0 foreground pixel regressions. Deterministic15/30/60FPS replay and real complete combat remain covered.

Remaining actionable work: physical Android and sustained memory/thermal validation; more adversarial high-density navigation and quantitative command latency; legacy and war scenario side-balance study; more capable sector-aware defensive redeployment; final art and safe-area polish. Arbitrary crowd completion and large-map phone readiness are not claimed. FlowerWars-MINI was read in a temporary reference checkout to compare cache/navigation/index patterns; none of its repository files or assets were changed or copied.
