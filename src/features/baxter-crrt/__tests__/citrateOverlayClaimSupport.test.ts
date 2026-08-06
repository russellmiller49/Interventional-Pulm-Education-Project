/**
 * The citrate overlay's own prose is learner-facing, and it was making the two claims the term
 * panel now labels "Awaiting a source".
 *
 * `CrrtPilotCircuit` renders `overlay.summary` and `overlay.teachingPoint` straight to the learner,
 * and `crrtCircuitTextEquivalent` appends the teaching point. So while the seven first-use terms
 * were corrected, the same screen went on saying — as settled fact, under three records that
 * support none of it — that citrate acts inside the circuit by binding calcium and that
 * citrate-calcium complexes leave in the effluent.
 *
 * This suite holds the overlay to the same rule as the terms: the settled prose carries module
 * topology only, and anything needing `citrate-pharmacology` is named as awaiting a source rather
 * than asserted.
 */
import {
  crrtCircuitOverlay,
  crrtCircuitTextEquivalent,
  crrtCitrateOverlayStatements,
  unsupportedCrrtCitrateOverlayCitations,
  unsupportedCrrtCitrateTermCitations,
} from '../content/circuitModel'
import { crrtSourceSupportsClaim, isResolvableCrrtSourceId } from '../content/learnerSourceMap'

const CLINICAL_CONTEXT_IDS = [
  'REVIEW-CKRT-CORE-2025',
  'TEXT-CRRT-NEYRA-2026',
  'GUID-RRT-ICU-2026',
] as const

/** Wording that asserts citrate pharmacology as settled fact. */
const SETTLED_PHARMACOLOGY_PATTERNS: readonly {
  readonly name: string
  readonly pattern: RegExp
}[] = Object.freeze([
  { name: 'citrate binds calcium', pattern: /citrate[^.]*\bbinds?\b/i },
  { name: 'the calcium it binds', pattern: /calcium it binds/i },
  { name: 'complexes leave in the effluent', pattern: /complexes[^.]*\bleave\b/i },
  { name: 'citrate acts inside the circuit', pattern: /citrate[^.]*\bacts? inside\b/i },
  { name: 'clotting is slowed', pattern: /clotting is slowed/i },
])

/** Anything that would turn a topology view into a bedside instruction. */
const PROHIBITED_QUANTITY_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] =
  Object.freeze([
    { name: 'dose unit', pattern: /\b\d+(\.\d+)?\s*(mmol|mEq|mg|mL\/kg\/h|µmol|umol)\b/i },
    { name: 'ratio', pattern: /\b\d+(\.\d+)?\s*:\s*\d+(\.\d+)?\b/ },
    { name: 'named target', pattern: /\b(target|goal|aim for)\b/i },
    { name: 'titration', pattern: /\b(titrat\w*|increase by|decrease by)\b/i },
    {
      name: 'monitoring frequency',
      pattern: /\b(every|q)\s*\d+\s*(h|hours|hourly|minutes|min)\b/i,
    },
    { name: 'threshold', pattern: /\b(alarm limit|threshold|cut-?off|upper limit|lower limit)\b/i },
  ])

const overlay = crrtCircuitOverlay('citrate-calcium')
const textEquivalent = crrtCircuitTextEquivalent('citrate-calcium')

/** The three learner-facing forms that must agree. */
const LEARNER_FACING_FORMS = [
  { name: 'overlay.summary', text: overlay.summary },
  { name: 'overlay.teachingPoint', text: overlay.teachingPoint },
  { name: 'crrtCircuitTextEquivalent', text: textEquivalent },
] as const

describe('the citrate overlay is held to the same rule as the citrate terms', () => {
  it('leaves the term-level closure untouched', () => {
    expect(unsupportedCrrtCitrateTermCitations()).toEqual([])
  })

  it('classifies every citrate-overlay statement as topology or a declared source gap', () => {
    expect(crrtCitrateOverlayStatements.length).toBeGreaterThan(0)
    for (const statement of crrtCitrateOverlayStatements) {
      expect(['module-authored-topology', 'registered-source-gap']).toContain(
        statement.claimSupport.kind,
      )
      expect(statement.text.trim().length).toBeGreaterThan(0)
    }
    // Both halves are represented: the view is neither all-settled nor all-gap.
    const kinds = new Set(crrtCitrateOverlayStatements.map((s) => s.claimSupport.kind))
    expect([...kinds].sort()).toEqual(['module-authored-topology', 'registered-source-gap'])
  })

  it('names exactly the two pharmacology claims as awaiting a source', () => {
    const gaps = crrtCitrateOverlayStatements.filter(
      (statement) => statement.claimSupport.kind === 'registered-source-gap',
    )
    expect(gaps.map((statement) => statement.id)).toEqual([
      'citrate-slows-clotting-mechanism',
      'citrate-calcium-leaves-in-effluent',
    ])
    for (const gap of gaps) {
      expect(gap.claimSupport.requiredTopic).toBe('citrate-pharmacology')
      expect(gap.claimSupport.supportingSourceIds).toEqual([])
    }
  })

  it('states no pharmacology as settled fact in any of the three learner-facing forms', () => {
    const settledForms = [
      { name: 'overlay.summary', text: overlay.summary },
      { name: 'overlay.teachingPoint', text: overlay.teachingPoint },
    ] as const

    const findings = settledForms.flatMap((form) =>
      SETTLED_PHARMACOLOGY_PATTERNS.filter((rule) => rule.pattern.test(form.text)).map((rule) => ({
        form: form.name,
        rule: rule.name,
      })),
    )
    expect(findings).toEqual([])
  })

  it('cannot attach a source merely because the ID resolves', () => {
    for (const id of CLINICAL_CONTEXT_IDS) {
      expect(isResolvableCrrtSourceId(id)).toBe(true)
      expect(overlay.sourceIds).not.toContain(id)
      expect(crrtSourceSupportsClaim(id, 'circuit-topology')).toBe(false)
      expect(crrtSourceSupportsClaim(id, 'citrate-pharmacology')).toBe(false)
    }
    // Whatever the overlay does cite must support what the overlay actually says.
    expect(unsupportedCrrtCitrateOverlayCitations()).toEqual([])
    for (const id of overlay.sourceIds) {
      expect(crrtSourceSupportsClaim(id, 'circuit-topology')).toBe(true)
    }
  })

  it('keeps both source gaps visible in the text equivalent', () => {
    for (const gap of crrtCitrateOverlayStatements.filter(
      (statement) => statement.claimSupport.kind === 'registered-source-gap',
    )) {
      expect(textEquivalent).toContain(gap.text)
    }
    expect(textEquivalent).toMatch(/awaiting a claim-specific source/i)
  })

  it('keeps the settled topology in all three forms', () => {
    // The five things the drawing itself establishes.
    expect(overlay.summary).toMatch(/before the (blood )?pump/i)
    expect(overlay.teachingPoint).toMatch(/before the (blood )?pump/i)
    expect(overlay.teachingPoint).toMatch(/return lumen/i)
    expect(overlay.teachingPoint).toMatch(/separate line|its own line/i)
    for (const form of LEARNER_FACING_FORMS) {
      expect(form.text).toMatch(/circuit|patient/i)
    }
    // Neither domain substitutes for the other, in every form.
    expect(`${overlay.teachingPoint} ${textEquivalent}`).toMatch(
      /not interchangeable|neither .* substitutes|does not substitute/i,
    )
  })

  it('introduces no dose, target, ratio, timing, titration, or monitoring frequency', () => {
    const findings = [
      ...LEARNER_FACING_FORMS,
      ...crrtCitrateOverlayStatements.map((statement) => ({
        name: statement.id,
        text: statement.text,
      })),
    ].flatMap((form) =>
      PROHIBITED_QUANTITY_PATTERNS.filter((rule) => rule.pattern.test(form.text)).map((rule) => ({
        form: form.name,
        rule: rule.name,
      })),
    )
    expect(findings).toEqual([])
  })
})
