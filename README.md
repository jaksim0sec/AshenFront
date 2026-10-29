# AshenFront · 灰燼戰線

A playable, offline, mobile-first isometric squad RTS. Capture the central sector with four ten-soldier squads while an enemy bot contests it. Height, ramps, directional cover, line of sight and suppression affect the actual simulation.

## Run

Requires Node **22.8+** (validated with Node 24.19.0). No install, bundler, external assets or runtime packages.

```sh
cd /workspace/AshenFront
npm start
```

Open `http://localhost:8000` in a browser. Set `PORT=8080 npm start` to change port. Serve over HTTP; `file://` cannot load ES modules correctly. The included server is for development, not hardened Internet hosting.

## Play

- Blue-gray is your team A; ochre is the enemy B. Battle starts immediately.
- Tap a soldier or a numbered squad tab to select. Tabs also center the camera.
- **이동 / Move (M)** arms a destination tap. One accepted order exits the mode. Dragging/pinching never issues an order.
- **대기 / Hold (H)** cancels unstarted movement. A reserved step finishes; soldiers continue firing.
- **집결 / Rally (R)** sends the selected squad to the objective region. Give orders to all four squads; unselected squads retain their orders.
- **지원 / Support** arms an area strike: radius 3, 15 HP damage **including friendlies**, +15 suppression per affected squad, -10 cover condition. Two uses, 60-second cooldown between uses. Target must be in allied sight or an owned sector.
- Drag empty battlefield to pan; pinch/wheel or +/- to zoom (0.30–1.60). ◎ centers the objective; ⌖ centers the selected squad. Tap the tactical overview to move the camera.
- **제압** shows suppression. At 65, forward orders pause; after fire stops for 2 seconds, suppression recovers, and movement resumes at 35. **혼잡** means congestion; **경로 없음** means no static route.
- H0 dark trenches use authored exits and directional cover. H1 is ground. H2 light ridges obstruct lower sight lines. The tactical map shows contours and last-known enemies, never hidden live enemy positions.
- Hold the central sector uncontested for 45 scored seconds to win. Contest or absence freezes the progress; a new contender resets it. At 8 minutes, ownership then control duration breaks the tie; equality draws. The explicit freeze rule in the specification takes precedence over its shorthand word “continuous.”
- Ⅱ / Space pauses. ↻ starts a fresh battle with the same seed. `?seed=42` changes the deterministic seed.
- **절전 / Low power** uses DPR 1 and omits effects and small health bars; rules remain identical. Background tabs pause explicitly.

## Test and profile

```sh
npm test                     # DOM-free Node tests; no packages to install
npm run bench                # CPU simulation + full-duration living-unit movement soaks
# In another terminal, with npm start running:
python3 tests/browser.py      # four viewport/DPR combinations, touch/pinch/orders/support/endgame
npm run bench:browser        # 9 headless Chromium fighting-view samples
```

Browser tools need Python Playwright and Chromium. In a fresh tooling environment, install Playwright separately (`python3 -m pip install playwright`) and install Chromium with your system package manager; alternatively set `CHROMIUM_PATH` to its executable. These are test tools, not game dependencies. The cloud used for validation already provided both. Generated screenshots and JSON reports go in ignored `artifacts/`.

`?debug=1` displays FPS, sim p95, nav budget/backlog, visible units, terrain-cache builds and zoom. Developer-only `window.__ashen` exposes deterministic `step(n)`, `finishMatch()`, `screenCell(x,y)`, `loadFixture(64|128|256)`, `focus(x,y)`, `resetStats()`, and `stats()`. `loadFixture(128)` and `loadFixture(256)` are **experimental profiling fixtures**, not released mobile scale modes. They use 90v90 / 180v180 soldiers and three sectors: own at least two with presence for 75s, otherwise score at 20 minutes. ◎ cycles the selected sector and Rally targets it. Debug fixture loading enables both bots so profiling is repeatable.

## Implementation and limits

See [the implementation report](docs/IMPLEMENTATION_REPORT.md) for requirement coverage, evidence, measurement conditions, decisions and remaining gates, and [the original contract](docs/CORE_GAME_IMPLEMENTATION.md) for the full specification.

The default small game is playable. Physical Android validation, extended real-time device memory/thermal profiling, and production enablement of larger battlefields remain outstanding. Headless desktop results must not be interpreted as phone performance. No changes or assets were copied from FlowerWars-MINI.
