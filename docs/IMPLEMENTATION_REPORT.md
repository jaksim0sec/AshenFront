# AshenFront implementation report

Date: 2026-10-29 (Asia/Seoul). Branch: `main`. Implementation commit: `0004dcb3cc9be99a683a592a0d7b2fb460551409` (the subsequent report commit adds evidence/documentation and declares the Node22.8 tool floor). Final checkout SHA is available with `git rev-parse HEAD`; the workspace also records it in ignored `artifacts/final-delivery.json` after the final commit.

## Delivered game and requirement coverage

The default static application is a playable 64×48, 40v40 game against an objective bot, with commands, infantry combat, suppression, finite outcomes and limited area support. No package installation or asset downloads are needed to play. All implementation is native ES modules and Canvas 2D; no backend. Physical-phone acceptance has **not** been performed, so “playable on the validated cloud browser” is not a claim of all specification gates passing.

| ID | Implemented and verified | Remaining acceptance limits |
|---|---|---|
| AF-01 | Independent typed terrain arrays, exactly H0/H1/H2, reciprocal authored ramps, blocking edges, mirrored layout, earth faces and foreground soil lips, height-aware tile/face picking and shared interpolated unit hit positions | Minimal stylized soldier/soil shapes; no physical touch-device validation |
| AF-02 | Four ten-member squads, MOVE/HOLD/RALLY adapter, ownership and atomic rejection, incremental shared BFS, <=2,048 expansions/tick, rotating reservation priority, simultaneous chain/cycle commits, bounded retained detours, vacancy propagation into landing regions, explicit congestion/no-route | Arbitrary dense crowds and oversized overlapping destination requests are not universally proven to clear; large stress soaks still show substantial waits |
| AF-03 | Symmetric supercover LOS with opaque corner checks, abstract eye heights, spatial buckets, closest/ID target tie-break, seeded hit rolls, symmetric initial stagger, cooldown, directional/worn cover and death cleanup | Single basic infantry archetype, as requested |
| AF-04 | Incoming-shot suppression including misses, 65/35 hysteresis, movement pause with retained intent, 2-second recovery delay, explanatory UI | Balance values remain playtest candidates |
| AF-05 | Manhattan-radius-4 central point; exact 900-tick hold, freeze/reset semantics, ownership/control score fallback at 9,600 ticks and draw, end screen/restart | No campaign, recruitment or persistence |
| AF-06 | Deterministic staggered bot through the same command adapter; separate approach waypoints followed by shared 41-cell landing region; no hidden enemy-state reads; 20 seeded matches and 20 team-label swaps | Strategy is deliberately simple. Bot does not invoke artillery; balance is provisional |
| AF-07 | Two area support uses/team, 1,200-tick cooldown, allied LOS/owned-region validation, radius-3 one-shot event, 15 damage including friendly fire, +15 suppression once/squad, -10 cover, invariant height/topology | Minimal ring effect; no physical shell simulation |
| AF-08 | Development fixtures run the same playable core at 128×96/90v90 and 256×192/180v180, three sectors, two-sector 75s hold and score-based 20-minute cap; simulation and renderer profiled | **Not production-enabled.** Physical Android gate, extended real-time device memory/thermal test and dense-order completion remain open |
| AF-09 | Pointer taps/drag/pinch, wheel/buttons/keyboard, 0.30–1.60 zoom, >=44px commands, DPR1/2 responsive HUD, selectable squads, bounded viewport cache, visible-unit culling, last-known enemy overview, low-power mode, explicit background pause | No Android/iOS hardware verification; no detailed rigs needed for this silhouette renderer |
| AF-10 | 32 Node cases, four browser viewport/DPR scenarios plus focused moving-hit/occlusion regressions, 15/30/60FPS fixed-clock replay equality, CPU and browser performance scripts/raw evidence | Physical-device and long real-time browser acceptance unfinished; headless samples are short and unthrottled |

## Validation and phase record

No pre-existing executable tests existed. The specification was the sole starting file; no `AGENTS.md` was present. Test cases were introduced before each subsystem, observed failing for the missing behavior, then made green. New review regressions were likewise reproduced before fixes.

| Phase | Main commit | Evidence |
|---|---|---|
| A | `e97807a` | Terrain/topology/projection tests; subsequent visible-face and interpolated-pick regressions also pass |
| B | `5cd2143` | Ten-member ramp travel, atomic override/HOLD, opposing reservations, two-wide opposing friendly traffic, finite no-route; later 40-member landing regression passes |
| C | `6b1364c` | LOS/cover/deterministic fire, reservation cleanup on death, suppression pause/recovery |
| D | `f0d9b16` | Complete point-control match, bot trials, actual mobile-size Chromium commands/end screen |
| E/F | `0004dcb` | Support, three-sector scale fixtures, performance evidence, responsive controls, overview, replay and review fixes |

Final `npm test`: **32 passed, 0 failed, 0 skipped**. The runner uses `--test-isolation=none` so individual cases are executed and reported in this managed runtime; an earlier default runner summarized child files rather than reporting their nested cases. No formatter-only or zero-test result is used as readiness evidence.

`python3 tests/browser.py`: **passed**, Chromium at 390×844 and 1280×800, DPR1 and DPR2. Real DOM/pointer checks exercise select, move, one-shot order mode, HOLD, RALLY, support, pan, pinch, zoom, objective/squad focus, low-power mode, stable stationary terrain cache, button sizes, no horizontal overflow and a complete accelerated match to its result screen. No JavaScript page errors in those scenarios. Additional isolated checks select a moving soldier at zoom1.6 and sample a foreground soil pixel over an H0 soldier's lower silhouette. Screenshots are in ignored `artifacts/`.

Replays at synthetic 15/30/60 render rates produce identical authoritative checksums after 900 ticks, with an ordered command at tick0. Large elapsed-frame backlog runs at most 3 ticks/frame and remains observable instead of being discarded. This is a fixed-clock reproducibility test, not a physical display FPS claim.

Twenty default bot-vs-bot seeds all move, fire, produce objective progress and finish before the cap: **A15 / B5 / draw0**, 78.25–123.0 simulated seconds. Exact times and checksums are in `evidence/bot-trials.json`. Team-label swapping preserves behavior and swaps the outcome for all 20 seeds. A separate coordinate-mirrored 20-seed experiment produces **A10 / B10** (`evidence/mirror-trials.json`).

The original apparent side imbalance was investigated: a right trench was offset by one cell, adjacent small xorshift seeds produced correlated first-shot rolls, and team-wide initial fire phases differed. Terrain is now exactly mirrored, Mulberry32 decorrelates adjacent user seeds, and corresponding team actors share the initial cooldown schedule. Remaining 15/5 default versus 10/10 mirrored results mean **balance is not established**. Integer central-point placement and deterministic route/ID tie-breaks can still affect which side obtains a firing posture first. No handicap or hidden bot resources were added to force equal wins.

## Performance conditions and evidence

See `evidence/benchmark.json` for complete records, raw memory samples, actor queries, LOS checks, navigation expansion counts, movement/blocked counters and deterministic checksums. These are **accelerated cloud CPU simulations**, not elapsed phone play sessions. Host: Debian13, Linux6.18.55, AMD EPYC9V74; Node24.19.0; seed42. No target-phone inference is valid.

CPU results (milliseconds/tick):

| Board / initial actors | Mode / actual simulation seconds | p95 | p99 | max |
|---|---|---:|---:|---:|
| 64×48 / 80 | combat-match / 137.5s | 0.183 | 0.368 | 2.923 |
| 64×48 / 80 | living-movement-soak / 600s | 0.126 | 0.210 | 2.690 |
| 128×96 / 180 | combat-match / 148.5s | 0.228 | 0.401 | 3.443 |
| 128×96 / 180 | living-movement-soak / 600s | 0.195 | 0.297 | 2.409 |
| 256×192 / 360 | combat-match / 188.5s | 0.312 | 0.461 | 3.856 |
| 256×192 / 360 | living-movement-soak / 1200s | 0.411 | 0.614 | 13.673 |


Combat runs stop when the actual match ends; their shorter duration is not represented as a 10/20-minute combat match. Living-movement soaks preserve every actor, disable combat and objectives, and reissue travel every40 seconds for the complete listed simulation duration. Their reported long waits include opposing actors that cannot swap, overlapping destination capacity, and interrupted long orders. They are **performance stress measurements, not proof that all such routes complete**. The 20-minute large soak observes 654 waiting ticks at its sampled maximum, one reason large mode remains experimental. Nav expansion peak is exactly2,048 across all scenarios.

Memory samples include GC-driven sawtooth behavior; the 360-actor soak's sampled ArrayBuffers reach about86MB and later fall. No monotonic-leak-free or 20-minute real-time device stability claim is made.

Browser results are in `evidence/browser-benchmark.json`: cloud **headless Chromium**, mobile viewport390×844, deviceScaleFactor2, no CPU throttling. Each fixture is advanced until actual shots occur, camera placed at a shooter, then warmed up; metric buffers reset before a **4-second wall-time sample**. Every sample must have rendered soldiers. Initial and remaining actors are reported separately. Close zoom1.0, low zoom0.3 and low-power zoom0.3 are measured for each board. Startup/fast-forward tasks are excluded from the sampled long-task window; cached terrain build counts and live tick progression are recorded.

| Board | Zoom / low mode | Live / initial actors | Render p95 / p99 ms | Sim p95 / p99 ms | Frame p95 ms |
|---|---|---|---|---|---:|
| 64 | 0.3 / False | 57 / 80 | 0.90 / 1.20 | 0.30 / 0.40 | 16.70 |
| 64 | 1.0 / False | 57 / 80 | 0.60 / 0.70 | 0.30 / 0.40 | 16.70 |
| 64 | 0.3 / True | 57 / 80 | 1.10 / 1.40 | 0.30 / 0.30 | 16.80 |
| 128 | 0.3 / False | 162 / 180 | 1.00 / 1.70 | 0.50 / 0.60 | 16.70 |
| 128 | 1.0 / False | 162 / 180 | 0.60 / 0.80 | 0.50 / 0.50 | 16.70 |
| 128 | 0.3 / True | 161 / 180 | 1.00 / 1.40 | 0.60 / 0.80 | 16.70 |
| 256 | 0.3 / False | 326 / 360 | 1.20 / 1.60 | 0.70 / 0.70 | 16.70 |
| 256 | 1.0 / False | 326 / 360 | 0.90 / 1.20 | 0.70 / 0.80 | 16.70 |
| 256 | 0.3 / True | 325 / 360 | 1.10 / 2.00 | 0.70 / 1.10 | 16.80 |

All nine samples completed without page errors or recorded >=50ms long tasks in their sampling windows. Chromium 154.0.8037.57.

These short headless samples do not replace the requested physical Android >=30FPS gate, prolonged dense fighting or command-latency p95 profiling. A manual low-power option is implemented; the measurements do not claim it improves every cloud sample.

## Independent review and decisions

An independent read-only reviewer found four important issues: overlapping bot destination capacity caused starvation; moving unit selection used logical coordinates; P1 timeout compared ownership first; and trench lower silhouettes were not obscured. Each was reproduced with a failing test and fixed in the final implementation commit. Vacancy chains admit every member of 2/4 uncontested bot squads; hit testing shares renderer interpolation; P1 timeout uses score; a view-only front soil lip covers the lower silhouette without changing floor physics. Additional checksum state coverage, wall-face picking and fresh-window/live-actor benchmark reporting also received regressions/corrections.

Decisions taken under the user's authorization:

- Implement progressively on the existing `main`; latest full-implementation request overrides the original document's historical “Phase A only” authorization note. No extra branches, worktrees or FlowerWars modifications. No push/publication was performed.
- Follow explicit contested/empty **freeze** semantics even though the shorthand says “continuous”; otherwise changing that rule would contradict the detailed objective test contract.
- Use a compact front soil lip with the specification's22px elevation example. It is visual occlusion only and has no LOS/navigation effect; artwork remains deliberately minimal.
- Keep larger boards accessible only through debug fixtures until hardware and dense-order gates pass. This costs immediate default large-map access, preserving the stable small game.
- Apply support to both teams in its radius and expose friendly-fire wording before the target tap. Balance and bot use of support remain future tuning work.
- Implement compatible projection/navigation concepts independently; no reference assets or code were needed and no provenance assumptions were introduced.

No outstanding review minor is hidden as a passing gate. Hardware, provisional balance and large dynamic congestion are explicit limitations above.

## Exact reproduction

```sh
cd /workspace/AshenFront
npm start
# Browse http://localhost:8000 (no npm install needed)
```

In another terminal:

```sh
cd /workspace/AshenFront
npm test
npm run bench
python3 tests/browser.py
npm run bench:browser
node tools/mirror-trials.mjs
git rev-parse HEAD
```

Browser checks require Python Playwright and Chromium; see README.md. For a development-only three-sector trial, open `?debug=1`, then run `__ashen.loadFixture(128)` or `__ashen.loadFixture(256)` in browser devtools. The initial full armies and normal rules remain intact; the profiler's fast-forward is optional and explicit. The default game is always64×48/40v40.
