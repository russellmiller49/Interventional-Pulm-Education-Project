# Phase D1 review packet — physician-owner review checklist

Phase D1 implementation document (2026-08-08). Suggested review path before any further exposure decision. Everything below is reachable by direct link only; nothing is indexed or in navigation.

## Walkthrough (15–20 minutes)

1. `/en/devices` — confirm the cohort statement (753 verified products; verified_source + prototype_visible) reads as you intend, and search a device you know well.
2. Open one device you know (e.g. a needle or scope) — check every fact against your knowledge: identifiers, dimensions, "not recorded" honesty, source citations, and that the two related-product lists read as discovery, never as substitution.
3. `/en/clinical-roles/EBUS_SCOPE` — confirm the selection guidance is quoted exactly as you authored it and the membership caption is acceptable.
4. `/en/procedures` — confirm the exemplar-set framing and the verbatim draft statuses.
5. Each workspace — spot-check requirement text, dependency rules, the modifier effects (especially DIGITAL_DRAINAGE and the two chest-tube techniques), and the CHEST_TUBE no-rescue statement.
6. Each `/readiness` page — confirm the DEMO watermark is impossible to miss, the real-formulary panel reads honestly, and the state legend matches your understanding of the D0 rules.
7. The five output tabs on one workspace — confirm nothing reads as a recommendation and the preference-card tab only links to the existing builder.

## Decisions this slice sets up (not taken by it)

- Public indexing of the atlas cohort (D-03 modification: needs your separate launch decision, an evidence-filtering audit, and a usability review).
- Whether candidate-grade facts ever join a public cohort (D-07 modification: separate public-content review).
- Consolidating the old catalog/product/use routes onto the new pages (D-04 defers; both families currently coexist).
- Populating `responsibleRole` on authored slots so the nursing preview can group meaningfully.
- Advancing any procedure out of draft — the watermarks come off only through your clinician review, never through code.

## Sign-off items

- [ ] Copy audit: no page asserts equivalence, interchangeability, or substitutability.
- [ ] The demo capability view cannot be mistaken for a real institution.
- [ ] Proposals appear only as labeled counts.
- [ ] The three procedures shown are exactly the exemplar set you selected.
- [ ] You are comfortable with the D1 routes existing at all while unlisted (they can be disabled by leaving `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE` unset in production, which is the current state).
