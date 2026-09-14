/** The original topology stays scoped to the drawing. Physiology needs claim-specific
 * publication support; source resolution alone still cannot authorize a claim or protocol. */
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

  it('classifies every citrate-overlay statement by topology or publication support', () => {
    expect(crrtCitrateOverlayStatements.length).toBeGreaterThan(0)
    for (const statement of crrtCitrateOverlayStatements) {
      expect(['clinical-publication', 'module-authored-topology']).toContain(
        statement.claimSupport.kind,
      )
      expect(statement.text.trim().length).toBeGreaterThan(0)
    }
    // Topology and clinical-publication support remain distinct.
    const kinds = new Set(crrtCitrateOverlayStatements.map((s) => s.claimSupport.kind))
    expect([...kinds].sort()).toEqual(['clinical-publication', 'module-authored-topology'])
  })

  it('ties the two pharmacology statements to read publication claims, without promoting review status', () => {
    const sourced = crrtCitrateOverlayStatements.filter(
      (s) => s.claimSupport.kind === 'clinical-publication',
    )
    expect(sourced.map((s) => s.id)).toEqual([
      'citrate-slows-clotting-mechanism',
      'citrate-calcium-leaves-in-effluent',
    ])
    for (const statement of sourced) {
      expect(statement.claimSupport.supportingSourceIds).toEqual(['CITRATE-SIAARTI-2023-MECHANISM'])
      expect(statement.claimSupport.basis).toMatch(/review is pending/i)
    }
  })

  it('keeps the overlay summary and teaching point scoped to topology', () => {
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

  it('does not invent unresolved physiology now that claim-specific sources exist', () => {
    expect(
      crrtCitrateOverlayStatements.filter((s) => s.claimSupport.kind === 'registered-source-gap'),
    ).toEqual([])
    expect(textEquivalent).not.toMatch(/awaiting a claim-specific source/i)
  })

  it('keeps the settled topology in all three forms', () => {
    // The five things the drawing itself establishes.
    expect(overlay.summary).toMatch(/before the (blood )?pump/i)
    expect(overlay.teachingPoint).toMatch(/before the (blood )?pump/i)
    expect(overlay.teachingPoint).toMatch(/return lumen/i)
    expect(overlay.teachingPoint).toMatch(/separate line|its own line|line runs separately/i)
    expect(overlay.teachingPoint).toMatch(/In this schematic/)
    expect(overlay.teachingPoint).toMatch(/does not establish the infusion site for other/)
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
