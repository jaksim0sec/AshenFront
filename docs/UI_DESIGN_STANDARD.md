# AshenFront · Mandatory UI Design Standard

> Applies to the live FlowerWars-engine game UI (`body[data-engine=flower]`).
> Source of truth: `src/flower-ui.css`. Updated: 2026-10-30.
> This contract supersedes historical gray/monochrome menu designs in older planning documents; it does **not** silently restyle the `?legacy=1` game or soldier workshop.

## Required color palette

All game menus and controls must follow the **bottom command UI**: dark muted warm-brown surfaces, subtle pale-gold strokes, ivory text/icons. Avoid mixing a second blue-gray/slate theme, turning ordinary controls bright gold, or enclosing unrelated actions in one large box.

| Token | Color | Purpose |
|---|---|---|
| `--af-command-bg` | `#56462fe9` | Main surfaces, HUD, circular commands and settings |
| `--af-command-raised` | `#705a3ee8` | Nested buttons in menus |
| `--af-command-hover` | `#806a4deb` | Pointer-hover feedback |
| `--af-command-edge` | `#d6c29a66` | Muted gold outlines |
| `--af-command-ink` | `#f9edda` | Text and command icons |
| `--af-command-muted` | `#dccdb4` | Secondary information |
| `--af-command-selected` | `#ad956ddf` | Primary / active state |
| `--af-command-selected-edge` | `#f1d8a9` | Selected outline |
| `--af-command-deep` | `#281f16` | Legible text on selected controls |

These tokens belong in `src/flower-ui.css` and must be reused. Avoid unrelated hard-coded colors in future menus. Any exception should have an explicit, information-bearing purpose.

## Component rules

- **Top HUD and expanded battle-status menu** (`#match-hud`): brown/gold status pill; nested actions raised brown; important action highlighted with selected-gold state. Preserve compact time/phase hierarchy.
- **Top gear and expanded settings** (`#tools-toggle`, `#game-tools`): matching surface, strokes, button backgrounds, link/checkbox colors and hover/pressed states. Do not replace them with gray panels.
- **Bottom commands and formation menus** (`#command-dock`, `#formation-panel`): independent, tactile controls using the same palette. Avoid one enormous background container.
- **Roster** (`#roster-panel`): keep approved warm gradient **squad cards, portraits and typography unchanged**. Their detailed card treatment is a deliberate exception. Compact platoon headers and multi-select use the dark command controls.
- Faction flag colors, soldier art, terrain and combat effects are gameplay artwork, not alternate menu palettes.

## Interaction standards

- A platoon heading selects the **current two live match squads** in that visible platoon, including those deployed *after* its button was created. Its fold control affects display only, not selection.
- Individual squad cards choose individual squads unless additive selection is enabled; eliminated squads cannot be selected. Show grouped selection state.
- Minimap opens by default as a circular, non-animated radar, with mobile width set to 32.5vw (the desktop 180px radar remains unchanged). Its small X is intentionally hidden for now; reopen the radar from the menu. It must stay below alerts and result overlays. A tap dismissing any other open menu must not accidentally deploy or command troops.
- Keep panels separate by function, keep the selected squad information chip content-sized rather than stretched with empty space, respect screen safe areas and touch target sizes, preserve short transitions and `prefers-reduced-motion`, and maintain meaningful `aria-pressed`/`aria-expanded` values.

## Tools, compact commands and global overlay order

- Use a monochrome three-dot More SVG on the top-right tool button, and a simple eye SVG for the selected-unit View action.
- Do not restore redundant `+`, `−`, `◎`, `⌖` mini camera buttons inside tools. Named view shortcuts and fit-to-front remain, with wheel/pinch zoom on the battlefield.
- The selected-unit line should fit its label, status and adjacent actions without a blank flex stretch. Keep the five order buttons together with comfortable touch targets and compact gaps.
- Overlay priority: radar below tactical menus, tactical menus below alerts, alerts below the full-screen result modal. Full-screen result and notifications must not inherit battlefield filter/stacking effects.
- Preserve existing troop cards and gameplay logic; changes to controls or layout must not alter active command behavior.

## Verification gate

Before declaring UI changes complete, check HUD open/closed, settings open/closed, mobile and desktop layout, fold/unfold, incremental deployment followed by platoon selection, multi-selection and elimination. A code review or automated test is not a substitute for a physical phone screenshot; report each verification level accurately.

## App identity assets

The approved two-army opposing-cap emblem is the single PWA/browser app identity. `assets/branding/app-icon.br` stores a compressed palette image master; `tools/pwa-icon.mjs` generates 32px favicon, 180px Apple touch icon, 192px/512px normal PNGs and separately padded 192px/512px maskable PNGs. The build and development server must use the **same** icon generator. Include the source blob in the release hash so existing offline installs are offered the changed icon with the next PWA update.
