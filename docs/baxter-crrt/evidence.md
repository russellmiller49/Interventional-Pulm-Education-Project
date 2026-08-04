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
- `src/features/baxter-crrt/components/CrrtPrescriptionWorkbench.tsx`
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
- `src/features/baxter-crrt/components/CrrtPilotCircuit.tsx` — the renderer over that data.

Two module-local harnesses run directly, with nothing added to `package.json`:

```
npx tsx scripts/baxter-crrt/dump-crrt-numbers.ts
npx tsx scripts/baxter-crrt/render-crrt-circuit.ts
```

The dump treats the makeup term explicitly: `MATH-PM-001` carries it into the effluent total and
`FLUID-PM-002` omits it, so any non-zero makeup flow is flagged rather than displayed as patient
loss. Authored examples keep it at zero.

Local manuals are reference inputs and remain uncommitted. The repository stores citations,
revision identifiers, hashes, paraphrased claims, limitations, and original educational visuals—not
copyrighted manual reproductions.
