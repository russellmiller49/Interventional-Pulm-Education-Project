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
- a product-centric verification workbench joining current catalog, backlog, source, GUDID,
  and procedure-impact evidence without mutation;
- read-only openFDA/GUDID identity-enrichment proposals kept separate from canonical data;
- server-side enforcement of exact product-to-role catalog relationships;
- deterministic, nonselectable review proposals for missing exact-slot options;
- separate catalog-alternative and curated-default coverage metrics that are not labeled
  readiness or approval;
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

- All 13 procedures have deterministic generated scenarios. Clinical and operational review
  remains required before any one is treated as pilot-ready.
- The workbook’s 179 compatibility statements remain raw evidence except for the few manually typed fixtures.
- Only literal quantities are evaluated.
- The admin recipe view is status-only; full authoring is deferred.
- Catalog QA is read-only.
- The verification workbench describes evidence availability and conflicts; it does not record
  reviewer decisions, approve products, release visibility, or establish local formulary state.
- Exact-slot proposal review is read-only. All 429 current proposals remain unreviewed,
  nonselectable, and separate from the 2,073 canonical options. The 18 drainage options
  promoted through the completed focused review are selectable but nondefault and do not
  imply local stocking or brand preference.
- openFDA high-confidence classifications remain unapproved candidates; they do not alter clinical readiness, procurement status, compatibility, or local formulary state.
- The 429 current slot-option proposals are unreviewed and nonselectable; broad role equality
  is not exact-slot eligibility.
- Catalog alternatives and curated defaults are source-data coverage measures. Neither
  establishes compatibility, local approval, or a resolved card's readiness.
- Custom items remain per-user, unverified local requirements rather than an organization
  formulary.
- The database catalog load is deliberately controlled and separate from the non-destructive JSON import.
- Print output uses browser Print/Save as PDF; there is no PDF service.
- Locale bundles contain English fallback copy for this feature.

## Local run

```bash
npm install
npm run ip-cards:import
npm run ip-cards:coverage
npm run ip-cards:scenarios
npm run ip-cards:validate-data
npm run ip-cards:seed
npm run dev
```

Open `/en/preference-cards` as an authenticated user. Development enables the feature automatically. Production additionally requires:

```text
NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS=true
```

To exercise database persistence, use the already-applied
`20260727224807_add_ip_user_preference_cards.sql` schema, then grant the authenticated user
either `preference_cards_builder` or `site_admin`. Do not run `supabase db push` for this
repository; the local and remote migration histories diverge, as documented in the current
session handoff. Without a valid authenticated persistence context, saving intentionally
fails rather than claiming that a database save occurred.
