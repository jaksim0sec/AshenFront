# AshenFront · 灰燼戰線

Offline, mobile-first Canvas 2D squad RTS. Command 40 infantry against a bot across real trench floors, ground and ridges. Seize the enemy command post or eliminate its army; the elapsed clock never ends a battle.

## Soldier workshop

Open **병사** in the header or `/soldier-workshop.html` to adjust the supplied character parts by country/rank, preview animations, and download final JSON. The same catalog and animations render in battle. See [the workshop guide](docs/SOLDIER_WORKSHOP.md) for import/export and applying published defaults.

## Run

Node22.8+; validated on Node24.19.0. No installation or build step.

```sh
cd /workspace/AshenFront
npm start
```

Browse `http://localhost:8000`. `PORT=8080 npm start` changes the development port. ES modules require HTTP.

## Command

- Tap **분대** to open the squad controls, a soldier to select its squad, or a squad tab to center it. The battlefield fills the screen; **지도** toggles the collapsed overview.
- **이동 (M)** selects a formation anchor. Tap the destination once: a unique two-rank footprint, resolved H level and latest order ID remain visible. Exact movement finishes at **10/10**, adjusted for casualties. `partial`, `unreachable`, suppression and allied blocking are shown explicitly.
- **대기 (H)** stops unstarted movement and retains fire. **집결 (R)** explicitly requests a bounded area around the selected strategic sector. **철수** sets a formation anchor at your own HQ; suppression can still pause movement.
- Retargeting replaces intent immediately and preserves an already reserved step. Repeating an identical order keeps its generation and slots. Changing the area radius creates a new generation.
- **지원** gives two radius-3 area strikes,60 seconds apart:15 HP damage including friendlies,15 suppression per affected squad,10 cover wear. Target must be visible to allies or inside an owned uncontested sector.
- Drag/pinch/wheel and +/- move/zoom the camera; orders never fire during camera gestures. Zoom range0.30–1.60. ◎ cycles strategic sectors; ⌖ centers your squad. Space pauses; ↻ restarts the same seed. Use `?seed=42` for another seed.
- Dark H0 trenches have authored exits and directional cover. H2 ridges interrupt lower LOS. At suppression65 advancing orders pause; after incoming fire stops for2 seconds, recovery resumes movement at35.
- Hold the enemy HQ perimeter with no enemy defenders remaining to seize it. Contested HQs cannot fall. Elimination also wins; simultaneous terminal conditions draw. Central trench and high-ground sectors grant positional cover and support access, with ownership retained when empty; they do not win by timer.
- **절전** uses DPR1, distant soldier markers and fewer effects. Background tabs explicitly pause.

## Verify

```sh
npm test
python3 tests/browser.py
python3 tests/infrastructure-browser.py
node tools/infra-benchmark.mjs
npm run bench:browser
```

Keep `npm start` running for browser tools. Python Playwright and Chromium are test-only prerequisites, already present in the validated cloud. On another machine install them separately, or set `CHROMIUM_PATH` to an existing Chromium executable. Game runtime has no external packages.

`?debug=1` enables bounded command transition logs (`__ashen.state.orderEvents`), hit/order inspection, navigation budgets, sim/render timings and cache statistics. Developer methods include `step(n)`, `finishMatch()`, `loadFixture(64|128|256)`, `focus(x,y)`, `screenCell(x,y)` and `stats()`. The128/256 fixtures use90v90/180v180 **experimental** war scenarios; only64×48/40v40 is the default release.

The low-level `createMatch()` API retains the old point-control fixture for reproducibility of the original32 tests. The application and debug battlefield fixtures explicitly select `scenario:'war'` and share the same engine, movement, combat and world arrays. Original timer tests remain compatibility checks, not current gameplay rules.

See [the infrastructure report](docs/INFRASTRUCTURE_REPORT.md) for commits, exact tests, screenshots, profiling and limitations. [The previous report](docs/IMPLEMENTATION_REPORT.md) records the earlier prototype. No FlowerWars-MINI files were modified or copied. Physical Android, thermal stability, arbitrary crowded-order completion and final art remain unverified.
