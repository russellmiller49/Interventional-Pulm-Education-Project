# Baxter CRRT v1 evidence and provenance

## Evidence policy

Every runtime claim is classified as one of:

1. **Device-manual behavior** — tied to the named device, manual number, revision, and page/section.
2. **Clinical context** — supports general educational reasoning, not a device setting or local rule.
3. **Synthetic calibration** — owns every exact case value, event, coefficient, score rule, and
   success band; never presented as a normal, target, alarm threshold, or recommendation.

Reviewer and source-status fields are informational for the final SME pass. They do not activate or
deactivate runtime content.

## Primary and archival sources

- PrisMax: official AW8035 Rev B operator manual, program 2.XX. This is the only device profile in
  the learner runtime.
- Prismaflex: supplied G5036003 Revision 05.2011 operator manual, program 6.xx. It remains archival
  provenance and supports a brief prior-platform transfer note; it does not activate an adapter,
  selector, calculation branch, or cross-device exercise.
- [NICE NG148 recommendations](https://www.nice.org.uk/guidance/ng148/chapter/Recommendations).
- [2026 multidisciplinary ICU RRT guideline](https://link.springer.com/article/10.1186/s13054-025-05817-6).
- [2025 CKRT Core Curriculum](https://pubmed.ncbi.nlm.nih.gov/40072400/).
- Published studies retained in the source registry for prescribed-versus-delivered therapy and
  complete fluid-ledger context.

The KDIGO 2026 AKI/AKD public-review draft is not authority for runtime rules. It may be reconsidered
only after a final publication replaces its draft status.

## Source interpretation rules

- Never generalize one manual revision to an institution's installed configuration.
- Never infer a set, solution, accessory, stocked item, alarm reaction, or workflow not established
  by the PrisMax manual-reference profile or a later validated local extension.
- The learner runtime is PrisMax-only. Historical Prismaflex material is provenance, not an
  operational device option.
- Preserve `CONFLICT-001` and `CONFLICT-002` as unavailable PrisMax expressions; do not repair
  punctuation, signs, parentheses, or missing terms by assumption.
- Keep device removal/variance distinct from the complete patient fluid ledger.
- Citrate sources may support recognition, linked trends, checks, reassessment, and escalation only.

## Implementation map

The main evidence-to-runtime boundaries are implemented in:

- `src/features/baxter-crrt/content/release.ts`
- `src/features/baxter-crrt/content/artifactRegistry.ts`
- `src/features/baxter-crrt/content/completeCases.ts`
- `src/features/baxter-crrt/content/learnerRegistry.ts`
- `src/features/baxter-crrt/content/curriculum.ts`
- `src/features/baxter-crrt/content/learnLessons.ts`
- `src/features/baxter-crrt/content/provenance.ts`
- `src/features/baxter-crrt/content/phase7ReviewSources.ts`
- `src/features/baxter-crrt/content/deviceProfiles.ts`
- `src/features/baxter-crrt/content/rapidDrills.ts`
- `src/features/baxter-crrt/content/instructionalTools.ts`
- `src/features/baxter-crrt/content/mastery.ts`
- `src/features/baxter-crrt/content/schema.ts`
- `src/features/baxter-crrt/content/runtimeCaseNormalization.ts`
- `src/features/baxter-crrt/engine/types.ts`
- `src/features/baxter-crrt/engine/reducer.ts`
- `src/features/baxter-crrt/engine/learningSession.ts`
- `src/features/baxter-crrt/engine/outcomes.ts`
- `src/features/baxter-crrt/engine/progress.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/types.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/registry.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/prismax.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/calculations.ts`
- `src/features/baxter-crrt/components/BaxterCrrtModuleFrame.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtModuleNav.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtHub.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtLearn.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtPractice.tsx`
- `src/features/baxter-crrt/components/BaxterCrrtAssess.tsx`
- `src/features/baxter-crrt/components/CrrtCasePlayer.tsx`
- `src/features/baxter-crrt/components/CrrtStagedPrescriptionBuilder.tsx`
- `src/features/baxter-crrt/components/CrrtCitrateDifferential.tsx`
- `src/features/baxter-crrt/components/CrrtPressureLocalizationLab.tsx`
- `src/features/baxter-crrt/components/CrrtRapidDrillReview.tsx`
- `src/features/baxter-crrt/components/SourcesPanel.tsx`
- `src/lib/baxter-crrt-analytics.ts`

### Universal circuit, fluid ledger, and numeric audit (C0/C1)

One circuit-and-fluid model is reused by every later modality explanation, prescription control,
pressure story, and case. Its geometry, overlays, and pressure semantics are authored data rather
than component branches, so the fixed orientation is testable rather than a drawing convention.

- `src/features/baxter-crrt/content/circuitModel.ts` — the single coordinate table, the nine overlays,
  and the authored measured-versus-calculated distinction. Overlay and pressure citations are
  validated at import against the pilot, supplemental, and device-math registries together, because
  the Learn surface resolves only the first two and drops unknown ids silently.
- `src/features/baxter-crrt/circuitFluidLedger.ts` — the conservation ledger, derived from
  `MATH-PM-001` and `FLUID-PM-002` rather than from new physiology, plus the authored worked example
  in which 2,100 mL/h of effluent accompanies 100 mL/h of patient loss.
- `src/features/baxter-crrt/numericAudit.ts` — the flag logic behind the numeric dump, kept in the
  feature so every flag class is covered by tests rather than only by a script.
- `src/features/baxter-crrt/content/learnerSourceMap.ts` — the one registry a learner-facing citation
  resolves against.
- `src/features/baxter-crrt/components/CrrtPilotCircuit.tsx` — the renderer over that data.

The citrate view is a bounded topology-and-first-use layer, approved as such. `crrtCitrateCalciumTerms`
in `src/features/baxter-crrt/content/circuitModel.ts` names where citrate enters, what it does inside
the circuit, where the calcium it binds can leave, where calcium replacement is given, and which
sample describes which compartment. Each term carries its own CRRT provenance. It carries no dose,
ratio, numeric goal, or titration or timing instruction — the same boundary `ConceptualCitrateState`
draws in the engine.

### Staged prescription builder and the citrate comparison (C2/C3)

- `src/features/baxter-crrt/stagedPrescriptionModel.ts` — the three stages, the goal catalogue, the
  causal construction order, and the predicted consequences. It performs no arithmetic of its own:
  every quantity comes from `prescriptionWorkbenchModel.ts`, `circuitFluidLedger.ts`, or
  `engine/clinicalMath.ts`. The one composition it adds is the treatment window, so a delivered
  intensity is the engine's own dose expression over the rate the window actually produced.
- `src/features/baxter-crrt/components/CrrtStagedPrescriptionBuilder.tsx` — the renderer. Stage 3
  mounts `CrrtPilotCircuit` with the constructed flows, so the module still has exactly one circuit
  and exactly one fluid ledger.
- `src/features/baxter-crrt/content/citrateDifferential.ts` — the mechanism walk, which points at the
  existing `crrtCitrateCalciumTerms` by id rather than redefining them, and the four-way comparison.

The four-way comparison separates insufficient citrate effect, inadequate calcium replacement,
citrate accumulation, and citrate-related alkalosis. Citrate-related alkalosis is not treated as a
name for accumulation or as a stage of it.

**Open source boundary.** No registered CRRT source record carries a claim about citrate metabolism.
The three clinical-context records the module cites for citrate — `TEXT-CRRT-NEYRA-2026`,
`REVIEW-CKRT-CORE-2025`, `GUID-RRT-ICU-2026` — carry framing, mechanism-concept, and
prescribed-versus-delivered claims, and none of them states what citrate is metabolised to, what
accumulation is, or how alkalosis arises. Every field of the comparison is therefore typed as either
`topology` (follows from the authored circuit) or `held-open` (not answered by the registered set,
and rendered as an open question rather than filled in). `SYNTH-LAB-CITRATE-001` records that limit.
Expanding the registered source set so the held-open rows can be answered is an SME task, not a code
change.

### Two closures, not one

Resolution and support are different questions, and the module now checks both.

- **Syntactic closure** — does the citation resolve to a registered record?
  `unresolvedCrrtCircuitSourceIds()` and `unresolvableCrrtSourceIds()` answer this, and throw at
  import when they do not. Necessary, and on its own not sufficient.
- **Claim-specific semantic support** — does that record's own registered `claim` string cover the
  topic the statement needs? `crrtSourceSupportsClaim()` in `content/learnerSourceMap.ts` answers
  this against a hand audit of the `claim` strings, and
  `unsupportedCrrtCitrateTermCitations()` throws at import for any citation that resolves but does
  not support.

The seven C0/C1 citrate/calcium first-use terms are the case that made the difference concrete. All
seven cited the same three clinical-context records; all three resolved; and the circuit printed
them under each definition as `Sources: REVIEW-CKRT-CORE-2025, TEXT-CRRT-NEYRA-2026,
GUID-RRT-ICU-2026`. Those records' registered claims are about transport mechanisms, modality
concepts, treatment goals, modality logistics, delivered therapy, access, fluid-removal tolerance,
and the prescribed-versus-delivered gap. **Not one of them says anything about where citrate enters
a circuit, what it binds, which sample describes which compartment, or where calcium replacement
runs.** The chips resolved and were still misleading.

Each term now declares the topic its statement needs, and is one of two kinds:

| Term                          | Kind              | Rests on                                         |
| ----------------------------- | ----------------- | ------------------------------------------------ |
| `citrate-entry-point`         | authored topology | PBP/citrate source and entry, blood pump, filter |
| `circuit-anticoagulation`     | **source gap**    | needs `citrate-pharmacology` — unmapped          |
| `circuit-sample`              | authored topology | circuit sampling domain, filter                  |
| `systemic-sample`             | authored topology | systemic sampling domain, patient                |
| `citrate-calcium-in-effluent` | **source gap**    | needs `citrate-pharmacology` — unmapped          |
| `calcium-replacement`         | authored topology | calcium source, calcium infusion line, patient   |
| `blood-returns-to-patient`    | authored topology | return lumen, return line, patient               |

Topology terms are read off this module's own circuit schematic and name the nodes and paths a
reviewer can check them against; `SYNTH-LAB-CITRATE-001` is their provenance and its claim was
broadened to say exactly that. The two source-gap terms keep their landed wording — nothing was
invented, expanded, or narrowed to close them — and render an explicit "Awaiting a source" state in
both the circuit term panel and the C3 mechanism walk. `citrate-pharmacology` is deliberately left
unmapped to every record, so no future citation can be pressed into supporting it by accident.

Raw evidence-record ids no longer appear as learner copy in the term panel; they remain in
`data-evidence-ids` for the provenance checks.

**Still open at the overlay level.** The `citrate-calcium` overlay's own `teachingPoint` restates
the same mechanism ("citrate-calcium complexes can leave in the effluent") and still lists the three
clinical-context records in `overlay.sourceIds`. Those ids are not rendered as learner-facing claim
chips — they appear only on the reviewer render page — so this closeout left them alone rather than
re-auditing C0/C1 overlay provenance it was not scoped to. Re-auditing every overlay's `sourceIds`
against `crrtSourceSupportsClaim` is the natural next step once an SME expands the source set.

Two module-local harnesses run directly, with nothing added to `package.json`:

```
npx tsx scripts/baxter-crrt/dump-crrt-numbers.ts
npx tsx scripts/baxter-crrt/render-crrt-circuit.ts
```

### CONFLICT-CRRT-MAKEUP-001 — the makeup term does not reconcile

`MATH-PM-001` (manual p217) defines the effluent target as
`Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup`, carrying the makeup term. `FLUID-PM-002`
(manual p219) defines the machine patient-fluid-removed term as
`Vpfr = Veff - Vpbp - Vdial - Vrep - Vsyr`, omitting it. Subtracting an effluent total that contains
makeup with an expression that does not subtract it leaves the makeup volume inside the patient
removal term. The registered sources were searched again at closeout and no third record reconciles
them, so the conflict is preserved rather than resolved — the same disposition the module already
takes for CONFLICT-001 and CONFLICT-002.

The consequence is enforced in code, not merely documented. A non-zero makeup flow puts the ledger
into `unresolved-makeup-attribution`: the membrane term, the net-fluid-to-patient term, the machine
patient-fluid-removal term, the effluent ratio, and the whole-patient balance are all **withheld**,
every dependent conservation identity reports `unresolved` rather than `balanced`, and the volume is
never attributed to patient fluid loss. Authored C0/C1 examples hold makeup at zero. The record lives
at `src/features/baxter-crrt/circuitFluidLedger.ts` as `CRRT_MAKEUP_ATTRIBUTION_CONFLICT`.

### Learner-facing citations resolve against every registry

`src/features/baxter-crrt/content/learnerSourceMap.ts` is the single merge point for the module's
four source registries — pilot, supplemental, device-math, and device-profile. Before it existed the
Learn surface merged only the first two and dropped anything else without warning, so seven cited
records rendered nothing: `MATH-PM-002` (the TMP formula), `FLUID-PM-002` (the fluid ledger),
`MATH-PM-004`, `MATH-PM-006`, `DEV-PM-008`, `DEV-PM-012`, and `DEV-PM-014`. Where an id appears in
more than one registry the record the module already rendered keeps winning.

`src/features/baxter-crrt/__tests__/learnerSourceMap.test.ts` enumerates every citation made by every
learner-facing surface — lessons, clinical anchors, circuit overlays, pressure details, and citrate
terms — and fails closed if any one does not resolve, including a case proving an unknown id is
named rather than skipped.

Local manuals are reference inputs and remain uncommitted. The repository stores citations,
revision identifiers, hashes, paraphrased claims, limitations, and original educational visuals—not
copyrighted manual reproductions.
