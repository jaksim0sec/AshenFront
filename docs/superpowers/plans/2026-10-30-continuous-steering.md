# Continuous Squad Steering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove distance-based soldier spacing and reduce avoidable local navigation searches without replacing verified grid navigation, squad commands or team rules.

**Architecture:** Retain shared coarse pathfinding, existing per-cell reservation for collision safety, and faction-aware combat. Add bounded deterministic subcell separation derived from nearby logical occupants, updating only when occupancy changes, plus a fast wait path for an already-moving blocker. Test all changes on an isolated branch before considering a true free-position occupancy migration.

**Tech Stack:** Node 22+ native ES modules, node:test, Canvas 2D.

**Spec:** Existing conversation design (Shared Path + Formation Steering + Spatial Hash) and src/fw/FLOWERWARS transplant architecture.

## Global Constraints
- Do not change main or game assets.
- Keep team A/B mirrored; no faction-priority steering.
- Keep formation slots, collision-safe cell reservations, combat LOS and squad orders.
- Limit additional per-update computation and allocation, keep spacing subcell bounded.
- This phase does **not** remove logical cell occupancy; that requires a separate large-scale combat/formation compatibility migration.

## Review Focus
- Two allies on adjacent cells separate symmetrically.
- Enemy bodies use the same separation distance without changing team identity or attack eligibility.
- Null/invalid/dead actors are excluded.
- Separating soldiers never cross tile boundaries or enter blocked tiles.
- A moving blocker should not trigger a costly detour before it clears.
- 350 vs 350 performance must be compared with matching seeds and scenarios.

### Task 1: Add bounded deterministic spacing

**Files:** Create `src/fw/separation-steering.mjs`, modify `src/fw/model.mjs`, `src/fw/ashen-setup.mjs`, add `tests/flowerwars-steering.test.mjs`.

**Interfaces:** `separationOffset(board, unit) -> {x,y}` with offsets bounded to +/-0.18 per coordinate.

- [ ] Write tests for team-neutral separation, bounded no-offset single unit, sparse idle update and continuously interpolated movement.
- [ ] Confirm RED on branch CI (missing module).
- [ ] Implement local 3x3 neighbor scan with current `cells`/`reservations`, no extra neighbor index.
- [ ] Update offsets at navigation cadence with occupancy-version caching; smooth visual offsets in `Board.advance` without changing authoritative grid positions.
- [ ] Enable only the AshenFront FlowerWars scenario via explicit Board constructor option.
- [ ] Confirm GREEN on Node 22 and full test suite.

### Task 2: Eliminate premature detour on moving blocker

**Files:** Modify `src/fw/navigation.mjs`, extend `tests/flowerwars-steering.test.mjs`.

- [ ] RED test: moving allied/enemy blocker retains low search-expansion count before clearance.
- [ ] When desired cell is blocked by a moving actor, wait for its arrival or timeout before detour/recovery requests.
- [ ] Keep target-independent fallback and existing cooperative fairness after timeout.
- [ ] Run full navigation + combat regression suite and capacity probe.

### Task 3: Review, report and verify

**Files:** Add `docs/superpowers/reports/2026-10-30-steering-experiment.md`.

- [ ] Run Node 22 full tests and benchmark from branch CI.
- [ ] Record numerical before/after if tested with matching scenarios; never claim faster without measured comparison.
- [ ] Inspect diff, no unintended character/assets or main changes.
- [ ] Keep experiment isolated; do not merge.
