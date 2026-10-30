# FlowerWars original-engine playable transplant

Default route loads the new FlowerWars-based simulation. Query ?legacy=1 loads the previous AshenFront engine and UI, preserved for regression.

Core files from FlowerWars-MINI main at 0d4e7a5 have been copied into src/fw: Board, cooperative Navigation, combat, formation planner, squad commands, FlagMatch, deployment, BotCommand and the full strategy/doctrine dependencies.

The first implementation uses original FlowerWars game simulation and 176x128 battlefield, but renders troops with existing AshenFront published catalog, PNG art, soldier animations and rank profiles. Four 10-person rifle squads per side use original FlagMatch deployment, original squad commands and bot operations. Original FlowerWars character art, multiplayer and equipment are not imported.

The original AI operation size is adapted to one squad so that the four bot squads receive distinct tactical roles. Rifleman parameters are centralized in src/fw/ashen-setup.mjs.

The first pass explicitly does NOT carry AshenFront H0/H1/H2 elevations, connected ramps, suppression, artillery or custom cover yet. These exist in legacy mode only. The map is original FlowerWars terrain with AshenFront colors. The original renderer has not been copied. The FlowerWars UI composition (right-hand squad roster on desktop, bottom mobile roster, bottom command dock) is now applied using AshenFront's palette. Approved assets/factions/*/flag.webp are drawn as physical flag objectives and displayed in the HUD. Fire effects are muzzle flashes, tracers and small earth debris instead of white circular hit bubbles.

Smoke test: node --test tests/flowerwars-port.test.mjs. Browser/manual combat validation is still needed before declaring this production ready.

---

# AshenFront · 灰燼戰線

Offline, mobile-first Canvas 2D squad RTS. Command 40 infantry against a bot across real trench floors, ground and ridges. Seize the enemy command post or eliminate its army; the elapsed clock never ends a battle.

## FlowerWars 구조 이식

처음에는 예비40명을 배치합니다. 하단 진형 카드를 고르고 아군 진영을 터치해10명씩 놓으세요. **자동 배치**와 **지휘 모드**로 배치를 확인하고 **전투 시작**을 누르면 싸움이 시작됩니다. 준비 시간은5분이며 전투 시작 시 남은 병력은 자동 배치됩니다. 전투 중에는 왼쪽 지휘관 목록과 하단 원형 명령을 사용합니다. 진형·전장 도구는 접이식 창으로 분리했습니다.


기존 고저차·엄폐·제압·포격·지휘소 점령 규칙을 유지하면서 FlowerWars의 지휘 화면, 복수 선택, 진형, 전술 명령과 AI 구조를 이식했습니다. **분대**에서 소대 전체 또는 개별 분대를 고르세요. **복수 선택**이나 Shift 클릭으로 함께 지휘할 수 있습니다. 횡대·종대·방진·산개, 이동·공격·우회·사수·집결을 지원합니다. 지점을 누르면 이동하고, 보이는 적을 누르면 집중 공격합니다. 명시적 명령은 버튼을 먼저 선택하세요. 드래그·핀치는 명령을 내리지 않습니다.

캐릭터·조립 JSON·국가별 설정과 기존 회색 팔레트는 보존했습니다. PvP·온라인 의존성·예비 병력 배치·깃발 파괴 규칙은 포함하지 않습니다. [이식 범위와 검증](docs/FLOWERWARS_TRANSPLANT.md).

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

See [the infrastructure report](docs/INFRASTRUCTURE_REPORT.md) for commits, exact tests, screenshots, profiling and limitations. [The previous report](docs/IMPLEMENTATION_REPORT.md) records the earlier prototype. FlowerWars-MINI algorithms and UI composition were adapted; its repository was not modified and its character artwork, PvP and CSS palette were not copied. Physical Android, thermal stability, arbitrary crowded-order completion and final art remain unverified.
