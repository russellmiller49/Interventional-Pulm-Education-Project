# Baxter CRRT v1 evidence and provenance

## Evidence policy

Every runtime claim is classified as one of:

1. **Device-manual behavior** — tied to the named device, manual number, revision, and page/section.
2. **Clinical context** — supports general educational reasoning, not a device setting or local rule.
3. **Synthetic calibration** — owns every exact case value, event, coefficient, score rule, and
   success band; never presented as a normal, target, alarm threshold, or recommendation.

Reviewer and source-status fields are informational for the final SME pass. They do not activate or
deactivate runtime content.

## Primary sources

- PrisMax: official AW8035 Rev B operator manual, program 2.XX.
- Prismaflex: supplied G5036003 Revision 05.2011 operator manual, program 6.xx.
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
  by the relevant manual-reference profile or a later validated local extension.
- Keep PrisMax and Prismaflex navigation, display formulas, scale topology, alarms, and stop/end
  behavior separate.
- Keep Prismaflex pump-target `Qeff` and dose-section `Qeff` separately named.
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
- `src/features/baxter-crrt/content/provenance.ts`
- `src/features/baxter-crrt/content/phase7ReviewSources.ts`
- `src/features/baxter-crrt/content/deviceProfiles.ts`
- `src/features/baxter-crrt/content/rapidDrills.ts`
- `src/features/baxter-crrt/content/instructionalTools.ts`
- `src/features/baxter-crrt/content/mastery.ts`
- `src/features/baxter-crrt/content/crossDeviceTransfer.ts`
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
- `src/features/baxter-crrt/engine/deviceAdapters/prismaflex.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/calculations.ts`
- `src/features/baxter-crrt/engine/deviceAdapters/prismaflexCalculations.ts`
- `src/features/baxter-crrt/components/BaxterCrrtLab.tsx`
- `src/features/baxter-crrt/components/CrrtLearningWorkflow.tsx`
- `src/features/baxter-crrt/components/CrrtPhase7InstructionalTools.tsx`
- `src/features/baxter-crrt/components/CrrtRapidDrillReview.tsx`
- `src/features/baxter-crrt/components/CrrtCrossDeviceTransferReview.tsx`
- `src/features/baxter-crrt/components/SourcesPanel.tsx`
- `src/lib/baxter-crrt-analytics.ts`

Local manuals are reference inputs and remain uncommitted. The repository stores citations,
revision identifiers, hashes, paraphrased claims, limitations, and original educational visuals—not
copyrighted manual reproductions.
