# Executive launch assessment

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

Research cutoff: `2026-08-10`. Frozen repository:
`2f26cb7632fe4e8f6835a8528458b672e8f360c2`.

## Outcome

The evidence packet is **ready for physician evidence review** and the product is **not ready for an
unlisted production beta**.

Three decisions are launch gates:

1. Adjudicate the 33 public AERO/AERO DV rows whose frozen `sterile_status="Sterile"` conflicts at
   the family-claim level with current manufacturer IFUs stating that the systems are supplied
   non-sterile. Obtain an explicit IFU/order-code applicability crosswalk before any exact-row
   correction through a governed forward release.
2. Define an exact, locally validated EBUS tower. The required video slot exposes four systems, but
   the only explicit BF-UC190F path located names CV-190 plus CLV-190; neither is a supported public
   choice in that slot.
3. Assign accountable physician owners and obtain revisioned signoff for EBUS_TBNA,
   THERAPEUTIC_BRONCH, and CHEST_TUBE. All 15 frozen procedures remain draft and no clinical owner is
   recorded.

The first two are evidence-backed content/system defects. The third is a governance defect. Passing
technical tests cannot replace any of them.

## What is already strong

The strongest bounded current claims are:

- BF-UC190F's named Olympus video/light/ultrasound platform row;
- exact Cook Olympus/non-Luer and Pentax/Luer EBUS needle labeling;
- current AERO and AERO DV non-sterile labeling;
- the Aspira same-system valve/accessory boundary;
- Rocket R51401's revised bag/clamp bulletin;
- CRE Pulmonary and Elation model-family working-channel, guidewire, inflation, and pressure
  requirements;
- ERBE APC/VIO and ERBECRYO 2 platform boundaries;
- ViziShot 2 FLEX 19G removal/quarantine evidence, with the frozen product already hidden;
- exact regulatory identities and lot-specific recall records for the 32 Portex configurations;
- exact GUDID identity/reuse records and current manufacturer specifications for the three
  Medtronic targets.

This list combines manifest-backed candidates with the broader read-only research inventory. The
generated reports and physician queue cover only the 86 manifest records / 47 targets. In
particular, the CRE/Elation, ERBE, stent-indication, laser/ETT, and Micro-Tech exact-code findings
remain outside that machine-readable candidate set unless a candidate ID is explicitly named.
Neither layer authorizes a runtime-data update.

## Launch risk summary

### BLOCKER

| Gate                                                           | Evidence                                                                                   | Frozen surface                                             | Resolution                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| AERO/AERO DV sterile-status conflict                           | Current family IFUs `490124001_001` and `401898002_002`; 33 frozen public rows cite SRC027 | THERAPEUTIC_BRONCH covered-stent selector and device pages | Exact IFU/order-code applicability, physician/owner adjudication, forward release, all-surface regression |
| Required EBUS video choice has no evidenced path for BF-UC190F | Olympus `OAIGI0624QRG52842`; slot `SLOT-7DFA66EA2D`                                        | EBUS_TBNA required VIDEO_PROCESSOR selection               | Exact local tower evidence, biomed/physician approval, exact options and filtering                        |
| No recorded clinical owner/signoff                             | 15 draft procedure records; no owner in frozen governance artifacts                        | All three D1 workspaces                                    | Named owners, approved claim/limitation packet, revisioned signoff                                        |

### HIGH

- Four Pentax/Luer Cook EBUS needle configurations are public while the public scope cohort is
  Olympus-only; broad role-level rules cannot enforce the hub family.
- Five therapeutic scopes and four video processors are independently selectable with no exact
  scope-to-platform edges.
- ReSolve 14 Fr and Atrium Oasis can be co-selected although no exact adapter/direct-fit evidence was
  located and Oasis describes its built-in connector for 24–40 Fr thoracic catheters.
- Aspira and Rocket IPC components can be mixed despite system-specific labeling; 13 chest rules
  resolve source products but not exact target components.
- The Rocket R51401 frozen source predates a material model-specific bag revision notice.
- 23 required/conditional Tier 1 slot rows, representing 18 unique roles, have no public verified
  Tier 2 product.
- Source titles/revisions are not usable as outbound, model-linked evidence on current device pages.
- Exact current primary sources remain missing for ERBE flexible APC probe SKUs and Micro-Tech
  TT-series stents.

### MEDIUM

- At 375 px, the THERAPEUTIC_BRONCH workspace measured 402 px of horizontal content because long
  compatibility-rule text did not wrap inside the viewport.
- Route-level `loading.tsx` and `error.tsx` fallbacks are absent; empty/source-missing states are
  incomplete.
- Local analytics calls returned 500 because Supabase URL/key configuration was absent. No database
  client or write succeeded, but failure UX/observability is weak.
- Print safety is partial; screenshot/readiness wording and source freshness cues need a deliberate
  review.
- No production-build payload or latency claim was substantiated in this sprint; only development
  behavior was inspected.
- Stale and undated sources are not surfaced strongly enough at decision time.

### LOW

- Translation completeness, fine-grained keyboard/a11y polish, and presentation consistency remain
  backlog items after the safety and provenance work.

## Active PR context

Orientation observed:

- PR #91: **OPEN, draft**, head
  `claude/device-intelligence-governed-data-corrections` at
  `eaad0ff9db17423a7c13472d15a85a8e29729e76`, base `main`.
- PR #92: **OPEN, draft**, head
  `claude/preference-card-definition-set-retention-f09` at
  `e1b45135380e4c4c142a04d862ce87f012a26c20`, stacked on the PR #91 branch.

These branches were inspected read-only and are not present in frozen main.

**RESOLVED IN ACTIVE PR — VERIFY AFTER MERGE:**

- PR #91 appears to address owner-disposition items F-04, F-05, F-06, and F-10, including the
  reviewed chest/airway role corrections.
- PR #92 appears to resolve F-09's rigid-APC hard-required behavior and adds definition-set
  retention/launch verification coverage.

They do not resolve the AERO conflict, exact EBUS tower, clinical ownership, Tier 0 expansion,
source-link UX, or the additional high-risk system boundaries above.

## Mission questions

### 1. What prevents a credible unlisted AABIP beta today?

The three blockers above. A safe demonstration also needs the high-risk cross-system combinations
bounded or explicitly unavailable, usable source provenance, and post-merge verification of PR
#91/#92.

### 2. Which current device-use claims are strongly supported?

The exact platform, hub, sterile/reuse, safety bulletin, working-channel, guidewire, pressure, and
same-system claims listed under “What is already strong,” within their exact source scope and
jurisdiction.

### 3. Which claims are unsupported, weak, stale, mismatched, or contradictory?

- Unsupported: frozen EBUS/therapeutic scope-to-video choices, ReSolve-to-Oasis fit, exact laser/ETT
  chain, exact ERBE APC probe rows, and exact Micro-Tech TT code labeling.
- Weak: many frozen source rows are brochures/catalogs rather than current model-specific IFUs.
- Stale/undated: the generated source report applies a 365-day review cue and lists each row.
- Scope-risk: family marketing cannot qualify an exact device, especially stents, needles, probes,
  and system components.
- Contradictory: the 33 AERO/AERO DV sterile fields versus current IFUs; Portex sources also contain
  bounded BOM/shelf-life/forceps differences requiring source/jurisdiction resolution.

### 4. Which external facts are strong future candidates?

Current AERO non-sterile status, Rocket R51401 revision behavior, exact Olympus/Cook/ERBE/Aspira
system boundaries, exact Medtronic blade specifications, and exact Portex regulatory identities and
recall states. Every one still requires the appropriate physician/owner/data review.

### 5. Which facts require physician interpretation?

Procedure and role placement; exact locally approved tower/system combinations; airway stent
indication and selection; balloon/wire/inflation-device selection; laser configuration; IPC system
configuration; Portex variant inclusion and nested-kit behavior; microdebrider component graph;
lot-level recall policy; and all clinical-owner signoff.

### 6. Which pages risk unsupported implication?

EBUS and therapeutic scope/processor selectors; EBUS needle selection; covered-stent device pages;
chest catheter/drainage and IPC selectors; laser proposal surfaces; and any page that displays a
source-derived fact without a usable exact source/revision link. The review found no automatic
promotion of hidden/candidate products.

### 7. What kind of gaps are present?

- Content: 18 Tier 1 roles with no public verified product.
- Source ingestion: current IFUs/bulletins exist but frozen facts or displayed provenance lag.
- Data model: componentized powered systems, nested kits, lot-level safety, exact target edges.
- UI/presentation: exact pair filtering, source links, wrapping, stale/missing states, print and
  operational feedback.

### 8. What was safe to implement here?

Only the versioned non-governed schema, validator, deterministic report generator, fixtures/tests,
and additive evidence/review documents. No runtime or governed data was changed.

### 9. Which apparent gaps are already addressed by active PRs?

The F-04/F-05/F-06/F-10 PR #91 items and F-09/definition-set retention/launch harness work in PR
#92, all classified **RESOLVED IN ACTIVE PR — VERIFY AFTER MERGE** until merged and tested.

### 10. What is the smallest post-PR sequence?

1. Merge/review PR #91 and #92 through their own workflows, then run their launch harness.
2. Obtain named clinical-owner signoff.
3. Correct AERO/AERO DV through a governed forward release.
4. Represent one exact locally validated EBUS tower and prevent unsupported needle/scope choices.
5. Bound the other high-risk cross-system combinations.
6. Add exact source/revision links and critical missing/stale states.
7. Verify public-unlisted/noindex/flag-off/rejection behavior plus mobile, error, analytics, and print
   checks.

### 11. What is the next logical procedure expansion?

`PERC_TRACH`, because the role already exists, the owner supplied 32 current distinct Portex
configurations, and the evidence exposes a coherent next domain. It is not a current D1 blocker and
requires nested-kit/medication/recall modeling before product authoring.

### 12. Which Tier 0 products are ready for physician adjudication?

All 35 exact configurations have stable evidence and decision records: 3 Medtronic and 32 Portex.
None passes the conservative “safe to propose for governed ingestion” gate because declared primary
evidence and/or system/BOM decisions remain incomplete. The exact identity/specification and recall
facts can be adjudicated now; product, role, procedure, compatibility, and kit behavior cannot.

## Recommended AABIP path

Aim for a bounded demonstration, not broad catalog completeness:

- keep the feature unlisted, noindexed, and flag-gated;
- expose only exact physician/biomed-approved systems;
- remove or block every unsupported cross-system path;
- show exact source, revision, scope, and freshness next to consequential facts;
- keep all candidate/hidden/recalled products rejected;
- carry explicit beta limitations for medium-risk polish;
- capture a signed evidence snapshot and launch checklist.

## Verdict

**READY FOR PHYSICIAN EVIDENCE REVIEW**

This verdict means the packet is sufficiently traceable and bounded for owner adjudication. It does
not mean production-ready, clinically approved, or authorized for governed ingestion.

This material is educational governance support, not clinical advice. Use current
jurisdiction-specific labeling and local clinical/biomedical governance.
