# IP preference-card v0.1 pilot readiness

## Current status

This release is a software prototype and is **not ready for clinical use**.

It demonstrates:

- deterministic catalog import and coverage reporting;
- three end-to-end golden scenarios;
- explicit local/generic resolution and unresolved states;
- reversible typed modifiers, conflicts, compatibility checks, rescue modules, and kit suppression;
- immutable hash-addressed previews and optional append-only database snapshots;
- spatial, chronological, exceptions, trace, and print views;
- protected mapping actions and read-only catalog verification QA;
- read-only openFDA/GUDID identity-enrichment proposals kept separate from canonical data;
- organization-aware RLS and feature-flagged production exposure.

Every output displays:

```text
DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE
```

## Required before any clinical pilot

1. Assign clinical and operational owners to each recipe.
2. Review every section-to-zone/phase mapping and eliminate unintended `unassigned` lines.
3. Verify the current local formulary, item numbers, UOMs, storage, availability, and substitution policy.
4. Replace every `demo_only` stand-in with reviewed local data or leave the requirement explicitly unresolved.
5. Review current manufacturer IFUs and validate every typed compatibility rule and matched system component.
6. Validate room capabilities, emergency-pull workflow, radiation safety, specimen handling, and service/personnel assumptions at each location.
7. Complete catalog verification priorities; GUDID remains identity enrichment only.
8. Run multidisciplinary tabletop and technician print-layout testing.
9. Establish approval, review-due, change-control, waiver, and supersession procedures.
10. Obtain institutional approval and configure the production feature flag only after sign-off.

## Known v0.1 limitations

- Only the three golden scenarios are operationalized.
- The workbook’s 179 compatibility statements remain raw evidence except for the few manually typed fixtures.
- Only literal quantities are evaluated.
- The admin recipe view is status-only; full authoring is deferred.
- Catalog QA is read-only.
- openFDA high-confidence classifications remain unapproved candidates; they do not alter clinical readiness, procurement status, compatibility, or local formulary state.
- The database catalog load is deliberately controlled and separate from the non-destructive JSON import.
- Print output uses browser Print/Save as PDF; there is no PDF service.
- Locale bundles contain English fallback copy for this feature.

## Local run

```bash
npm install
npm run ip-cards:import
npm run ip-cards:coverage
npm run ip-cards:validate-data
npm run ip-cards:seed
npm run dev
```

Open `/en/preference-cards` as an authenticated user. Development enables the feature automatically. Production additionally requires:

```text
NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS=true
```

To exercise database persistence, apply `20260725210000_add_ip_preference_cards.sql`, then apply `supabase/seed/ip_preference_cards_demo.sql`, load the normalized catalog through the controlled database workflow, add the user to the demo organization, and grant either `preference_cards_builder` or `site_admin`. Without those database steps, the builder intentionally falls back to a deterministic hash-addressed demo snapshot rather than claiming that a database save occurred.
