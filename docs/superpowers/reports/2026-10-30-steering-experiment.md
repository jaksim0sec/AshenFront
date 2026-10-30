# 2026-10-30 AshenFront steering experiment

## Scope and branch
- Source branch: `main` at `b1d12d25ff7ff95893c9a54add968ec553a94c7b`.
- Branch: `feat/continuous-squad-steering-20261030`.
- No modifications or merge to `main`. No character catalog or asset edits.
- Existing strategic pathfinding, occupancy reservation, formation slot assignment, AI and faction semantics remain authoritative.

## Implemented
1. `separationOffset(board, unit)`: deterministic team-neutral subcell (<= 0.18 coordinate/tile) separation. Lookups are limited to a 3x3 set of logical cells and their reservations. Duplicate moving-unit candidates are filtered without a per-actor temporary Set.
2. `Board.advance`: distance-based visual motion offsets are smoothed within the existing actor pass; targets are recomputed at most every 0.24s and only when occupancy version changes. FlagMatch AshenFront infantry opts in with `spacing:true`.
3. `updateSquadOrders`: immediate command issue is retained; redundant per-frame maintenance is rate-limited to 0.12s, or runs immediately when dirty.
4. Carried forward the concurrently merged main shot muzzle-rendering fix in `src/fw/visuals.mjs` because the original snapshot predates that bug fix and the test on the branch otherwise failed.

## TDD / correctness
- Initial tests were RED due to missing separation-steering module (GitHub Actions run 41015970058).
- Added seven focused tests: team symmetry, dead/remote actors, bounded visual offsets, disabled legacy behavior, moving actor arrival/occupancy, moving-blocker status, formation maintenance cadence.
- The moving-blocker test already passed before a navigation implementation change. Accordingly, the proposed speculative moving-blocker search patch was **not** applied.
- Green GitHub Actions: run 41016918090, full `npm test` 137/137 (Node24), focus tests 7/7 (Node22), 350v350 capacity probe 2/2 (Node24).
- Node22 cannot execute existing `npm test` script containing `--test-isolation=none`; the full suite is therefore run on Node24. This is a repository test-runner constraint, not a steering failure.
- Browser/mobile screenshot, real device FPS, thermal sustainability, and adversarial narrow-pass traffic remain unverified.

## Observed simulation performance
Identical seed/count test `tests/flowerwars-capacity.test.mjs` ran for six simulated seconds / 700 soldiers on hosted GitHub runners. These are wall-clock execution times, not mobile CPU or FPS.
- Main baseline: 540ms (a previous runner recorded 532ms).
- Feature commit `c641618e`: 557ms in full suite, 573ms in standalone repeat.
- Feature prior to fusing the steering pass: 634ms and 660ms in an earlier runner; the refactor reduced observed overhead, but runner variability prevents a controlled causal claim.
- **CPU improvement over main was not demonstrated.** On the latest independent runners the experiment was modestly slower, and movement trajectories differ due to the steering/maintenance change. No percentage speedup is claimed.

## Limits / next migration
This is an explicitly bounded **hybrid first phase**, not fully continuous occupancy. Physical/visual positions can shift within a tile, but the logical `x/y` path, exclusive cells, attack command range, and formation destination remain cell-based. A full nonexclusive continuous-position solver would require coordinated changes to occupancy, spatial collision constraints, `board.at`, enemy scanning, LOS/range, squad slot availability, and the replay/checkpoint representation, with new load-tested invariants before enabling.

## Recommendation
Keep isolated for gameplay and device performance comparison. Do not merge or switch to free occupancy solely on the basis of this experiment.
