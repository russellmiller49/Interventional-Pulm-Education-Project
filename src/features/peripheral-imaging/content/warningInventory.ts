/**
 * The warning and provenance inventory behind report CW2 (fellow walkthrough, PDF p.7).
 *
 * One interactive screen carried five separate caveats, and by Section 3 the reader had stopped
 * reading the yellow boxes — which means a warning that mattered would have been skipped too. The
 * repair is not a rule of one caveat per section. Each learner-facing statement is classed by what it
 * does, and only the first class — the same general provenance sentence, repeated wherever a model
 * is drawn — is consolidated: said in full at the start of every section (which is where a deep link
 * lands) and in Help, and shortened on the steps after. The other three classes stay exactly where
 * they qualify the teaching.
 *
 * This is data so a test can hold the classes to their treatment: nothing in classes 2–4 is removed,
 * and the consolidated class is still present in full on a section's first step.
 */
export type WarningCategory =
  | 'general-provenance'
  | 'figure-limitation'
  | 'immediate-safety'
  | 'unresolved-status'

export type WarningTreatment = 'consolidated' | 'kept' | 'reworded'

export interface WarningSurface {
  readonly id: string
  readonly category: WarningCategory
  /** Where it renders. */
  readonly where: string
  /** How a test finds it. */
  readonly selector: string
  readonly treatment: WarningTreatment
  readonly note: string
}

export const WARNING_INVENTORY: readonly WarningSurface[] = [
  {
    id: 'shared-model-boundary',
    category: 'general-provenance',
    where: 'The "Model limitations" aside on every step of every section',
    selector: '[data-teaching-block="boundary"]',
    treatment: 'consolidated',
    note: 'The shared sentence (CT anatomy plus authored target, instrument and numbers) is printed in full on the first step and in Help; later steps keep the section-specific limit and a one-line reminder.',
  },
  {
    id: 'demonstration-kicker',
    category: 'general-provenance',
    where: 'The kicker over every worked demonstration',
    selector: '[data-lesson-demonstration] [data-demonstration-kicker]',
    treatment: 'consolidated',
    note: '"Worked demonstration · authored teaching example" duplicated the scene header "Authored teaching model" on the same screen; the kicker now says "Worked demonstration".',
  },
  {
    id: 'modeled-not-fictional',
    category: 'general-provenance',
    where: 'Example titles, cues and control-group legends that said "fictional"',
    selector: '[data-look-for], [data-model-controls] legend',
    treatment: 'reworded',
    note: '"Fictional" became "modeled", the word the DTS overlay already uses; the statement that these are not real devices stays where it qualifies a figure.',
  },
  {
    id: 'section-model-boundary',
    category: 'figure-limitation',
    where: 'The section-specific limit in the "Model limitations" aside',
    selector: '[data-teaching-block="boundary"] [data-boundary-specific]',
    treatment: 'kept',
    note: 'What this section’s model does not represent, on every step.',
  },
  {
    id: 'held-example-banner',
    category: 'figure-limitation',
    where: 'The banner over a check’s held image',
    selector: '[data-suite-scene] [role="status"]',
    treatment: 'kept',
    note: 'Says whether the image depicts the question or is the section’s teaching model (PI-FELLOW-01).',
  },
  {
    id: 'dts-overlay-note',
    category: 'figure-limitation',
    where: 'The DTS overlay note',
    selector: '[data-dts-overlay-note]',
    treatment: 'kept',
    note: 'Drawn from the model’s coordinates, not detected in the image.',
  },
  {
    id: 'scout-legend-limits',
    category: 'figure-limitation',
    where: 'The CBCT scout legend',
    selector: '[data-cbct-state] [data-scout-legend]',
    treatment: 'reworded',
    note: 'Plain-language legend that keeps the teaching tolerance and the not-a-clearance-check limit.',
  },
  {
    id: 'before-an-exposure',
    category: 'immediate-safety',
    where: 'The amber cue on a section’s first step',
    selector: '[data-safety-cue]',
    treatment: 'kept',
    note: 'State the imaging question; coordinate care, clearance and protection with the team.',
  },
  {
    id: 'primary-beam-callout',
    category: 'immediate-safety',
    where: 'Section 17, "Keep hands out of the primary beam"',
    selector: '[data-safety-callout]',
    treatment: 'kept',
    note: 'Report 7.4: set apart as its own callout rather than left inside the paragraph.',
  },
  {
    id: 'acquisition-checklist-declared',
    category: 'immediate-safety',
    where: 'The CBCT readiness dock',
    selector: '[data-suite-controls] [data-learner-declared]',
    treatment: 'kept',
    note: 'Checklist confirmations are learner-declared; the scene detects no collision.',
  },
  // Prompt 04 (OD4-04, OD4-06, OD4-09, OD4-10): each new figure and aid says what it is before
  // anything else, on its own surface; none of these is folded into the shared sentence.
  {
    id: 'case-figure-model-label',
    category: 'figure-limitation',
    where: 'The label on a figure inside a practice or integrated case',
    selector: '[data-case-figure] [data-model-label]',
    treatment: 'kept',
    note: 'Teaching model or schematic, and what it is not (a patient acquisition, a scatter measurement); printed before the image.',
  },
  {
    id: 'teaching-figure-model-label',
    category: 'figure-limitation',
    where: 'The label on a Prompt 04 teaching figure (Sections 6, 9 and 16)',
    selector: '[data-teaching-figure] [data-model-label]',
    treatment: 'kept',
    note: 'Names the CT-derived model, which effects are simulated or drawn, and where no honest image exists.',
  },
  {
    id: 'fixed-mobile-model-note',
    category: 'figure-limitation',
    where: 'Under the fixed and mobile comparison (Sections 13 and 14)',
    selector: '[data-fixed-mobile-comparison] [data-model-note]',
    treatment: 'kept',
    note: 'The scenes draw the same field for both; they are authored illustrations, not a device comparison.',
  },
  {
    id: 'readiness-aid-status',
    category: 'figure-limitation',
    where: 'The first line of the team-readiness aid (Section 12)',
    selector: '[data-team-readiness] [data-readiness-status]',
    treatment: 'kept',
    note: 'A teaching aid, not an institutional, anesthesia or credentialing protocol or a universal checklist.',
  },
  {
    id: 'draft-illustrations',
    category: 'unresolved-status',
    where: 'The conceptual signal illustrations and the fictional dose record',
    selector:
      '[data-signal-comparison] [data-draft-status], [data-dose-record] [data-draft-status]',
    treatment: 'kept',
    note: 'Draft illustrations and an authored, fictional report: their review status is stated once each.',
  },
]

export function warningsInCategory(category: WarningCategory): readonly WarningSurface[] {
  return WARNING_INVENTORY.filter((surface) => surface.category === category)
}
