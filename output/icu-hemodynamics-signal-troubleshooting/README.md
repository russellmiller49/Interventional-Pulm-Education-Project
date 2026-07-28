# ICU hemodynamics signal-troubleshooting visual regression

Captured from the local Next.js application on 2026-07-23.

## Viewports and layout checks

- Desktop troubleshooting: 1440 px wide, 1500 px tall.
- Mobile troubleshooting: 390 px viewport override, 1600 px tall (375 px CSS content width with the browser scrollbar).
- Desktop fast-flush lab: 1440 px wide, 1500 px tall.
- Desktop document horizontal overflow: 0 px.
- Mobile document horizontal overflow: 0 px.
- Desktop nested simulation workspace: verified scrollable through its full 3945 px range at the standard 1440 × 1000 QA viewport.
- Mobile document: verified scrollable through its full 10344 px range at the standard 390 × 844 QA viewport.
- Browser console: no application errors; only expected Next.js Fast Refresh notices after source edits.

## Contact sheets

- `desktop-all-tabs.png` — all seven troubleshooting states at desktop width.
- `mobile-all-tabs.png` — all seven troubleshooting states at mobile width.
- `fast-flush-all-six.png` — PA and systemic arterial lines with acceptable, underdamped, and overdamped release responses.
- `mobile-reference-cards.png` — the corrected troubleshooting reference rendered as stacked mobile cards.

## Individual troubleshooting captures

Each `desktop/` and `mobile/` folder contains:

- `overdamped.png`
- `underdamped.png`
- `catheter-whip.png`
- `wall-contact.png`
- `spontaneous-wedge.png`
- `overwedging.png`
- `zero-level.png`

## Individual fast-flush captures

The `fast-flush/` folder contains:

- `pa-acceptable.png`
- `pa-underdamped.png`
- `pa-overdamped.png`
- `systemic-acceptable.png`
- `systemic-underdamped.png`
- `systemic-overdamped.png`
