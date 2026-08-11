# Post-merge implementation plan

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

This packet describes possible future work after PR #91/#92 are resolved through their own review
processes. It implements nothing. Every record requires the stated evidence and owner approvals, then
the normal governed forward-release workflow. Never edit generated output directly.

## Classification A — READY AFTER PHYSICIAN APPROVAL

### A-01 — Rocket R51401 current revision evidence

- **Target governed domain/file/table:** product-source registry and safety/description facts for
  exact model `R51401`.
- **Current identity:** Rocket IPC 2,000-mL drainage bag/dressing pack.
- **Proposed new identity:** none.
- **Current value:** frozen product relies on a 2021 brochure.
- **Proposed value:** attach CIB133 Rev01 and, after local-revision verification, surface the changed
  non-return-valve/clamp instruction as bounded current safety content.
- **Exact fields proposed:** source link, document ID/revision/date, locator, warning/handling
  summary, source-as-of date.
- **Supporting candidate:** `CHEST-ROCKET-R51401-WARNING`.
- **Strongest source:** [Rocket CIB133 Rev01](https://rocketmedical.com/wp-content/uploads/2025/12/cib133_ipc_drainage_bag_usa_rev_1.pdf).
- **Physician approval required:** yes; inventory/operations owner confirmation also required.
- **Additional evidence required:** confirm which bag revision is locally stocked.
- **Forward-release requirement:** yes.
- **Affected procedures:** `CHEST_TUBE`.
- **Saved-card/reconstruction implications:** identity remains stable; source-set/release revision
  changes and must reconstruct.
- **Testing required:** exact-model source display, warning fixture, old/new revision behavior, print.
- **Expected launch impact:** removes a high-risk stale safety/configuration gap.
- **PR #91 dependency:** verify final chest role scope after merge.
- **PR #92 dependency:** run release/definition retention checks.
- **Data-model work required:** no if revision provenance is already representable.
- **UX/runtime work required:** yes for prominent current-revision warning display.

## Classification B — NEEDS ADDITIONAL PRIMARY EVIDENCE

### B-00 — AERO/AERO DV sterile-status correction

- **Target governed domain/file/table:** product facts and source links that feed
  `data/ip-preference-cards/generated/catalog-products.json`; normal source/release inputs, not the
  generated file itself.
- **Current identity:** 18 AERO `90129-201…218` and 15 AERO DV
  `90129-301…306,310…318`; all exact product IDs are listed in
  `launch-critical-scope.md`.
- **Proposed new identity:** none; preserve all exact product IDs and order codes.
- **Current value:** `sterile_status="Sterile"`, attributed to SRC027.
- **Proposed value:** current jurisdiction-specific labeling value “Non-sterile,” only after an
  exact order-code/IFU applicability crosswalk and owner adjudication establish that scope.
- **Exact fields proposed:** sterile status, source ID/link, source document identifier/revision/date,
  exact applicability crosswalk, locator, verification note, release provenance.
- **Supporting candidates:** `AERO-STERILE-OFFICIAL`,
  `AERO-STERILE-FROZEN`, `AERO-DV-STERILE-OFFICIAL`,
  `AERO-DV-STERILE-FROZEN`.
- **Strongest source:** Merit IFU
  [490124001_001](https://cloud.merit.com/catalog/IFUs/490124001.pdf) and
  [401898002_002](https://cloud.merit.com/catalog/IFUs/401898002.pdf).
- **Physician approval required:** yes; also product-data owner approval.
- **Additional evidence required:** an explicit crosswalk connecting the applicable AERO/AERO DV
  IFU family section to each of the 33 exact frozen order codes, plus an institutional SKU check if a
  separately sterilized configuration is asserted.
- **Forward-release requirement:** mandatory; preserve source/release history and never patch frozen
  generated rows.
- **Affected procedures:** `THERAPEUTIC_BRONCH`.
- **Saved-card/reconstruction implications:** product IDs should remain stable; verify that revised
  facts and source set reconstruct without changing selection identity.
- **Testing required:** all 33 product rows; covered-stent selector/device pages; source/revision
  display; exact applicability; saved-card reconstruction; negative test against AEROmini spillover.
- **Expected launch impact:** closes a launch blocker.
- **PR #91 dependency:** no content dependency; start a fresh branch from final merged `main` and
  implement only after its final data shape is known.
- **PR #92 dependency:** run its retained-definition/release harness after the forward release.
- **Data-model work required:** no, unless a distinct sterilized configuration is proven.
- **UX/runtime work required:** source/conflict presentation is a separate Class D record.

### B-01 — Exact local EBUS tower

- **Target governed domain/file/table:** products, role links, slot options, and exact compatibility
  edges for `EBUS_SCOPE`, `VIDEO_PROCESSOR`, `ULTRASOUND_PROCESSOR`, and
  `ULTRASOUND_CABLE`.
- **Current identity:** BF-UC190F `PRD-2FFEEB98B2`, BF-UC180F
  `PRD-F586C51621`; required video slot `SLOT-7DFA66EA2D`.
- **Proposed new identity:** exact locally installed CV/light/ultrasound/cable/adapter/software
  configurations; do not guess IDs.
- **Current value:** four public video systems with no BF-UC190F source; CV-190 is hidden/candidate
  and CLV-190 lacks a governed product.
- **Proposed value:** only exact locally validated tower choices after evidence and owner approval.
- **Exact fields proposed:** exact product identities, role edges, slot options, compatibility
  source/locator, software/revision notes, visibility/verification status.
- **Supporting candidates:** `EBUS-BF-UC190F-PLATFORM`,
  `EBUS-VIDEO-SLOT-EVIDENCE-GAP`.
- **Strongest source:** Olympus
  [OAIGI0624QRG52842](https://medical.olympusamerica.com/sites/default/files/us/files/pdf/OAIGI0624QRG52842_CPO-Product-Comparison_QRG.pdf).
- **Physician approval required:** yes; biomed validation required.
- **Additional evidence required:** exact local inventory, BF-UC180F current path, adapters, service
  software, and current IFUs.
- **Forward-release requirement:** yes.
- **Affected procedures:** `EBUS_TBNA`.
- **Saved-card/reconstruction implications:** unsupported prior selections need a fail-closed
  migration/review state; definition-set retention must be tested.
- **Testing required:** exact positive/negative matrix, unavailable identity, hidden/candidate
  rejection, saved cards, source links.
- **Expected launch impact:** closes a blocker.
- **PR #91 dependency:** verify added EBUS roles do not change the tower boundary.
- **PR #92 dependency:** reuse, do not duplicate, its launch/reconstruction harness.
- **Data-model work required:** possibly, for multi-component platform configurations.
- **UX/runtime work required:** yes, exact filtering and unresolved-state UX.

### B-02 — Medtronic exact IFUs and operating chain

- **Target governed domain/file/table:** future product/source/role/compatibility inputs for
  `1899200`, `1884033HRE`, and `1884035HRE`.
- **Current identity:** all three exact products are wholly absent.
- **Proposed new identity:** preserve exact Medtronic order codes; no role/procedure assignment yet.
- **Current value:** regulatory identity/reuse and manufacturer specification facts only.
- **Proposed value:** exact IFU-supported handpiece, blade, controller, foot control, irrigation,
  suction, and access relationships.
- **Exact fields proposed:** identity, dimensions, sterile/reuse, package quantity, IFU
  ID/revision/date, component role, explicit relationship edges, warnings.
- **Supporting candidates:** all `T0-MDT-*` records.
- **Strongest source:** exact GUDID records and Medtronic
  [US-ENT-2400484 v1](https://www.medtronic.com/content/dam/medtronic-wide/public/united-states/products/ear-nose-throat/ent-blades-burrs.pdf).
- **Physician approval required:** yes.
- **Additional evidence required:** current exact package IFUs, M5 reprocessing manual, controller
  table, irrigation connection, rigid barrel requirement, and age scope.
- **Forward-release requirement:** yes, after the Class C component graph exists.
- **Affected procedures:** physician decision between `RIGID_BRONCH`, a future powered-airway
  pathway, and/or no mapping.
- **Saved-card/reconstruction implications:** new identities only; no backfill into old generic
  shaver choices without explicit migration.
- **Testing required:** exact-code uniqueness, component completeness, compatibility negative tests,
  sterile/reuse display, source scope.
- **Expected launch impact:** future expansion, not current D1 launch.
- **PR #91 dependency:** none known.
- **PR #92 dependency:** future definition-set retention once authored.
- **Data-model work required:** yes; see C-01.
- **UX/runtime work required:** likely a component/system selector after model work.

### B-03 — Portex current U.S. labeling and recall closure

- **Target governed domain/file/table:** future `PERC_TRACH_KIT` product/source records for all 32
  exact order codes.
- **Current identity:** exact rows exist only in the frozen raw GUDID index.
- **Proposed new identity:** one reviewed identity per exact code; do not collapse technique, tube,
  size, forceps, medication, or no-tube variants.
- **Current value:** GUDID identity/status plus family BOM sources and two open lot-specific recalls.
- **Proposed value:** current exact U.S. IFU/BOM/reprocessing/shelf-life/packaging/recall evidence for
  every code before any product proposal.
- **Exact fields proposed:** product identity, variant dimensions, sterile/reuse, kit contents,
  package quantity, IFU revision/date, warnings, recall state, source links.
- **Supporting candidates:** all 32 `T0-ICU-*` records.
- **Strongest source:** FDA `K173912`, recalls `Z-3088-2024`/`Z-3087-2024`, exact GUDID
  records, and ICU Medical `P25-6819`.
- **Physician approval required:** yes.
- **Additional evidence required:** current U.S. package IFUs, standalone forceps code/reprocessing
  guide, exact embedded-tube identities, BLUgriggs shelf life, medication counts, current recall
  status.
- **Forward-release requirement:** yes, only after C-02/C-03 decisions.
- **Affected procedures:** future `PERC_TRACH`.
- **Saved-card/reconstruction implications:** no automatic migration from generic/Cook/TRACOE kit
  rows; exact variants require stable identities and definition sets.
- **Testing required:** literal 32-code set, BOM profiles, recalled-lot state, no-tube behavior,
  medication jurisdiction, hidden/candidate rejection.
- **Expected launch impact:** owner-priority expansion; not current D1 blocker.
- **PR #91 dependency:** owner decision context only.
- **PR #92 dependency:** retained definitions and alias `PDT_KIT → PERC_TRACH_KIT`.
- **Data-model work required:** yes; see C-02/C-03.
- **UX/runtime work required:** yes for variant/BOM/lot-aware presentation.

### B-04 — ReSolve-to-Oasis connector chain

- **Target governed domain/file/table:** exact chest catheter, adapter, and drainage-unit relationship
  records.
- **Current identity:** ReSolve `RTT14038MB` / `PRD-B1E837841F`; public Atrium Oasis cohort.
- **Proposed new identity:** exact adapter/connector if proven.
- **Current value:** co-selection without an exact edge.
- **Proposed value:** exact dual-source supported chain or explicit blocked fit state.
- **Exact fields proposed:** adapter product identity, connector sizes, relationship source and
  locator, negative/unresolved state.
- **Supporting candidate:** `CHEST-RESOLVE-OASIS-GAP`.
- **Strongest source:** ReSolve product page and Atrium/Getinge IFU `EL011920-en Rev AA`.
- **Physician approval required:** yes; biomed/operations confirmation required.
- **Additional evidence required:** exact adapter documentation from both manufacturers or written
  confirmation.
- **Forward-release requirement:** yes if a relationship is approved.
- **Affected procedures:** `CHEST_TUBE`.
- **Saved-card/reconstruction implications:** old co-selections need review, not silent repair.
- **Testing required:** exact positive chain if proven; direct-fit negative test; saved-card warning.
- **Expected launch impact:** closes a high-risk implied-fit gap.
- **PR #91 dependency:** verify post-merge chest slot composition.
- **PR #92 dependency:** retained-definition verification.
- **Data-model work required:** perhaps an intermediate adapter edge.
- **UX/runtime work required:** unresolved/adapter-required state.

### B-05 — Held exact probe, stent, laser, and ETT sources

- **Target governed domain/file/table:** exact ERBE flexible APC probe, Micro-Tech TT stent, and
  OmniGuide/laser-resistant ETT product/relationship sources.
- **Current identity:** frozen ERBE probe SKUs from SRC019; frozen Micro-Tech TT codes; laser roles
  with proposals but no exact approved ETT chain.
- **Proposed new identity:** none until exact primary labeling is obtained.
- **Current value:** platform/family evidence or distributor/regulatory identity only.
- **Proposed value:** exact current manufacturer IFU/UDI/order rows and relationship documentation.
- **Exact fields proposed:** exact model IDs, IFU revisions, socket/cable/gas/working-channel data,
  stent jurisdiction, laser console/software/fiber/wavelength/ETT relationship.
- **Supporting candidate IDs:** none. This is a backlog-only read-only research-inventory item;
  `launch-critical-scope.md` records the gap, but the manifest and generated queue do not contain
  dedicated ERBE/Micro-Tech/laser-ETT candidates.
- **Strongest source:** ERBE APC 3/ERBECRYO manuals, FDA K212403, OmniGuide VELOCITY/IntelliGuide
  IFUs; none closes the missing exact relationships.
- **Physician approval required:** yes after evidence.
- **Additional evidence required:** exact manufacturer primary sources and current U.S. labeling.
- **Forward-release requirement:** yes if later approved.
- **Affected procedures:** `THERAPEUTIC_BRONCH`.
- **Saved-card/reconstruction implications:** proposal-only/held rows must remain unavailable.
- **Testing required:** exact code/source qualification and negative family-inheritance tests.
- **Expected launch impact:** bounds high-risk options; laser may remain outside the demo.
- **PR #91 dependency:** none known.
- **PR #92 dependency:** verify proposal/definition retention behavior.
- **Data-model work required:** possibly for complete laser/APC systems.
- **UX/runtime work required:** unresolved evidence and proposal-only states.

## Classification C — NEEDS DATA-MODEL CHANGE

### C-01 — Powered airway debridement component graph

- **Target governed domain/file/table:** roles, product-role links, slots, and exact system
  relationships for controller, foot control, handpiece, blade, irrigation/suction, and rigid access.
- **Current identity:** `RIGID_BRONCH_SHAVER` single-select role with eight mixed Richard Wolf
  products; no exact Medtronic targets.
- **Proposed new identity:** separate stable component roles and a validated system configuration.
- **Current value:** capital, reusable, disposable, and accessory components occupy one role.
- **Proposed value:** explicit component graph with cardinality, dependencies, source requirements,
  and no implicit cross-system pairing.
- **Exact fields proposed:** new/updated role codes, slot cardinality, component type, relationship
  edges, required/conditional rules, source provenance.
- **Supporting candidates:** all `T0-MDT-*` records.
- **Strongest source:** Medtronic catalog/brochure plus future exact manuals.
- **Physician approval required:** yes.
- **Additional evidence required:** B-02.
- **Forward-release requirement:** yes, after schema/fixture migration design.
- **Affected procedures:** likely `RIGID_BRONCH`; tracheal pathway remains a physician decision.
- **Saved-card/reconstruction implications:** explicit migration/review for old generic shaver
  selections; never reinterpret them automatically.
- **Testing required:** component completeness, cardinality, cross-system rejection, release and
  reconstruction.
- **Expected launch impact:** future capability, not current D1.
- **PR #91 dependency:** review owner role decisions after merge.
- **PR #92 dependency:** definition-set retention is central.
- **Data-model work required:** yes.
- **UX/runtime work required:** yes, a system/component workflow.

### C-02 — Portex nested-kit/BOM model

- **Target governed domain/file/table:** kit products, child component identities, slot satisfaction,
  and suppression/dependency structures for `PERC_TRACH`.
- **Current identity:** one required `PERC_TRACH_KIT` slot plus separate required tube, backup tube,
  adapter, suction, and dressing roles.
- **Proposed new identity:** exact 32-code product variants with evidence-backed BOM profiles BP0–BP5
  and BG0–BG5.
- **Current value:** no Portex governed products or child relationships.
- **Proposed value:** represent tube/no-tube, Suctionaid, forceps, medication, size, and included
  component distinctions without duplicate visible requirements.
- **Exact fields proposed:** kit variant, child component identity, quantity, satisfies-role,
  dependency, medication/jurisdiction flag, no-tube behavior, source locator.
- **Supporting candidates:** all `T0-ICU-*` records.
- **Strongest source:** ICU Medical current BOM page, `P25-6819`, FDA K173912, and future exact U.S.
  package IFUs.
- **Physician approval required:** yes.
- **Additional evidence required:** B-03 and exact embedded-product identities.
- **Forward-release requirement:** yes, after model migration/fixture review.
- **Affected procedures:** future `PERC_TRACH`.
- **Saved-card/reconstruction implications:** new definition sets; old kit/tube combinations must
  not be silently reinterpreted.
- **Testing required:** every exact BOM profile, no-tube cases, duplicate prevention, medication
  jurisdiction, saved cards.
- **Expected launch impact:** enables the next procedure expansion safely.
- **PR #91 dependency:** owner decision packet context.
- **PR #92 dependency:** alias and definition-set retention.
- **Data-model work required:** yes.
- **UX/runtime work required:** yes, nested-kit explanation and variant selection.

### C-03 — Lot-aware safety state

- **Target governed domain/file/table:** safety event/recall relation between exact product code and
  affected lot(s), with source/status timestamps.
- **Current identity:** Portex recalls identify lots for 29 codes; frozen data has only product-level
  facts.
- **Proposed new identity:** a source-backed safety event linked to exact codes and optional lots.
- **Current value:** no safe way to express “some named lots under open recall” without overstating
  whole-code status.
- **Proposed value:** event class/status, exact affected-code set, lot scope, last checked date, and
  owner release policy.
- **Exact fields proposed:** regulatory event ID, class/status, code IDs, lot identifiers, start/end
  or termination date, source/locator, review state.
- **Supporting candidates:** the 29 `T0-ICU-*-RECALL` records.
- **Strongest source:** FDA `Z-3088-2024` and `Z-3087-2024`.
- **Physician approval required:** yes; supply-chain/quality owner required.
- **Additional evidence required:** current recall termination/correction status and institutional
  lot process.
- **Forward-release requirement:** yes.
- **Affected procedures:** future `PERC_TRACH`; the pattern may later serve other device safety
  events.
- **Saved-card/reconstruction implications:** a saved exact product may require lot verification,
  not automatic invalidation.
- **Testing required:** partial-lot event, terminated event, code not listed, stale status, print and
  audit trail.
- **Expected launch impact:** future safety governance; not current D1.
- **PR #91 dependency:** none.
- **PR #92 dependency:** release provenance/reconstruction.
- **Data-model work required:** yes.
- **UX/runtime work required:** yes, lot verification and status cues.

## Classification D — NEEDS UX/RUNTIME CHANGE

### D-01 — Exact compatibility enforcement and provenance

- **Target governed domain/file/table:** runtime selectors and compatibility evaluation after
  physician-approved exact edges exist.
- **Current identity:** EBUS scope/video/needle, therapeutic scope/video/balloon/wire/inflation/APC,
  and chest IPC/fit surfaces.
- **Proposed new identity:** none; consume only approved exact edges.
- **Current value:** independent dropdowns and broad role-level prose can imply unsupported pairs.
- **Proposed value:** filter/reject unsupported combinations and display exact source, revision,
  locator, and scope.
- **Exact fields proposed:** runtime relation consumer, disabled/unresolved state, source link,
  compatibility rationale, telemetry code.
- **Supporting candidates:** `EBUS-BF-UC190F-PLATFORM`, Cook hub records,
  `THERAPY-SCOPE-VIDEO-GAP`, `CHEST-RESOLVE-OASIS-GAP`,
  `CHEST-ASPIRA-SYSTEM-BOUNDARY`.
- **Strongest source:** each candidate's exact Tier A source.
- **Physician approval required:** yes for every consumed edge.
- **Additional evidence required:** B-01/B-04 and exact local system identities.
- **Forward-release requirement:** runtime change plus governed release; do not hard-code research
  facts.
- **Affected procedures:** all three D1 exemplars.
- **Saved-card/reconstruction implications:** fail closed with a review state; preserve original
  identity and definition set.
- **Testing required:** complete positive/negative matrices, hidden/candidate rejection, stale edge,
  saved cards, keyboard and mobile.
- **Expected launch impact:** closes blocker/high implied-system risks.
- **PR #91 dependency:** implement against merged final data.
- **PR #92 dependency:** extend its harness without duplicating it.
- **Data-model work required:** exact edges must exist first.
- **UX/runtime work required:** yes.

### D-02 — Source, state, mobile, error, analytics, and print hardening

- **Target governed domain/file/table:** Device Intelligence route/UI/telemetry surfaces; no product
  fact changes.
- **Current identity:** three D1 workspaces and device detail pages.
- **Proposed new identity:** none.
- **Current value:** no outbound exact source links; weak stale/missing states; therapeutic mobile
  overflow; no route loading/error boundaries; local analytics 500; partial print acceptance.
- **Proposed value:** source/revision/freshness component, explicit missing/conflict states, responsive
  wrapping, safe loading/error/empty fallbacks, non-blocking analytics diagnostics, print-safe
  evidence context.
- **Exact fields proposed:** UI component props, route boundaries, telemetry event/error
  classification, CSS wrapping/print rules, localized strings.
- **Supporting candidate IDs:** none. This is a repository/runtime hardening item, not an external
  product-evidence candidate; its audit evidence is documented in `production-hardening-backlog.md`.
- **Strongest source:** repository/runtime audit; no external product claim is consumed.
- **Physician approval required:** wording/safety-state review; engineering owner approval.
- **Additional evidence required:** production performance baseline after implementation.
- **Forward-release requirement:** normal application release; governed data unchanged.
- **Affected procedures:** all three D1 exemplars.
- **Saved-card/reconstruction implications:** error/empty states must preserve and explain original
  identities.
- **Testing required:** 320/375/768/desktop, keyboard/screen reader, loading/error/empty, no config
  analytics, print/screenshot, source links, noindex and flag-off.
- **Expected launch impact:** makes the bounded beta demonstrable and auditable.
- **PR #91 dependency:** after merged data stabilizes.
- **PR #92 dependency:** use its launch harness and definition-set fixtures.
- **Data-model work required:** no for UI states; source link shape may need approved metadata.
- **UX/runtime work required:** yes.

## Classification E — DO NOT INGEST

### E-01 — ViziShot 2 FLEX 19G promotion

- **Target governed domain/file/table:** exact product `PRD-0D6E4DB711` /
  `NA-U403SX-4019`.
- **Current identity:** hidden, historical, do-not-procure.
- **Proposed new identity:** none.
- **Current value:** safely suppressed.
- **Proposed value:** keep hidden; add only recall-refresh safeguards.
- **Exact fields proposed:** no product promotion fields; optional safety-event linkage in a separate
  approved model.
- **Supporting candidate:** `EBUS-VIZISHOT-19G-RECALL`.
- **Strongest source:** [Olympus 2026-01-16 removal notice](https://medical.olympusamerica.com/articles/olympus-expands-voluntary-recall-vizishot-2-flex-19g-ebus-tbna-needles).
- **Physician approval required:** no promotion should be proposed; inventory closure is an
  institutional safety action.
- **Additional evidence required:** recall termination before any future reconsideration.
- **Forward-release requirement:** only for a recall-control feature, never to expose the product.
- **Affected procedures:** `EBUS_TBNA`.
- **Saved-card/reconstruction implications:** reject or warn on historical identity; never replace it
  automatically.
- **Testing required:** hidden/candidate rejection and stale-brochure re-ingestion guard.
- **Expected launch impact:** preserves a positive safety control.
- **PR #91 dependency:** none.
- **PR #92 dependency:** verify retained definitions cannot re-expose it.
- **Data-model work required:** optional safety-event model only.
- **UX/runtime work required:** historical/recall explanation if encountered.

### E-02 — Unqualified family, distributor, and cross-system assertions

- **Target governed domain/file/table:** any future product or compatibility proposal based only on
  family marketing, co-listing, distributor tables, guidelines, GUDID distribution fields, or local
  assumption.
- **Current identity:** especially Micro-Tech TT codes, laser/ETT chain, Portex embedded tubes,
  generic chest targets, and unsupported video systems.
- **Proposed new identity:** none until exact qualifying evidence exists.
- **Current value:** evidence gaps are explicitly recorded.
- **Proposed value:** retain the gaps; do not turn them into product facts or relationships.
- **Exact fields proposed:** none.
- **Supporting candidate IDs:** none for this general policy record. Individual manifest gaps retain
  their own candidate IDs, while this backlog-only guard also covers read-only inventory outside the
  manifest; the generated family/model report is not itself an evidence candidate.
- **Strongest source:** none that qualifies the missing exact claim.
- **Physician approval required:** a physician cannot make missing manufacturer compatibility
  evidence appear; exact evidence remains required.
- **Additional evidence required:** current exact manufacturer or regulatory source.
- **Forward-release requirement:** none while held.
- **Affected procedures:** all current/future procedures.
- **Saved-card/reconstruction implications:** fail closed; preserve unresolved identity.
- **Testing required:** validator rejection for unqualified exact and compatibility claims.
- **Expected launch impact:** prevents silent research-to-runtime promotion.
- **PR #91 dependency:** none.
- **PR #92 dependency:** verify proposal retention never becomes public coverage.
- **Data-model work required:** no.
- **UX/runtime work required:** explicit unresolved evidence state only.

## Smallest safe sequence after PR #91/#92

1. Verify active-PR fixes after merge without changing this packet's frozen observations.
2. Complete B-00 and the clinical-owner gate.
3. Complete B-01 plus the EBUS parts of D-01.
4. Bound Cook, therapeutic video, chest fit, and IPC system risks through D-01.
5. Complete A-01 and D-02.
6. Run the merged launch harness plus the unique negative/system/mobile/error/print checks above.
7. Keep B-02/B-03/C-01/C-02/C-03 as post-launch expansion work unless the owner reprioritizes them.

This plan is educational governance support, not clinical advice.
