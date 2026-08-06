/**
 * C3 — the citrate mechanism and the four-way comparison.
 *
 * Two things are pinned here that nothing else in the module pins. The first is that the four
 * categories stay four: citrate-related alkalosis is not a label for citrate accumulation, and
 * neither is a label for a calcium-replacement problem. The second is the prohibition list — no
 * dose, quantity, ratio, target, schedule, frequency, or threshold may appear in any string this
 * section renders, and the test enumerates the rendered strings rather than trusting a comment.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  CrrtCitrateDifferential,
  crrtCitrateComparisonTextEquivalent,
} from '../components/CrrtCitrateDifferential'
import {
  CRRT_CITRATE_DIFFERENTIAL_IDS,
  CRRT_CITRATE_HELD_OPEN_NOTICE,
  CRRT_CITRATE_SCOPE_NOTICE,
  crrtCitrateComparisonRows,
  crrtCitrateDifferentialCategories,
  crrtCitrateMechanismSteps,
  crrtCitrateMechanismWalk,
  unresolvedCrrtCitrateSourceIds,
} from '../content/citrateDifferential'
import { crrtCitrateCalciumTermById, crrtCitrateCalciumTerms } from '../content/circuitModel'
import { isResolvableCrrtSourceId } from '../content/learnerSourceMap'

/**
 * Anything that would turn a mechanism section into a bedside algorithm. Each pattern is written
 * so an ordinary teaching sentence cannot trip it by accident.
 */
const PROHIBITED_QUANTITY_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] =
  Object.freeze([
    {
      name: 'concentration or dose unit',
      pattern: /\b\d+(\.\d+)?\s*(mmol|mEq|mg|mL\/kg\/h|µmol|umol)\b/i,
    },
    { name: 'ratio', pattern: /\b\d+(\.\d+)?\s*:\s*\d+(\.\d+)?\b/ },
    {
      name: 'named target',
      pattern: /\b(target|goal|aim for|keep (?:it|the \w+) (?:above|below))\b/i,
    },
    {
      name: 'titration schedule',
      pattern: /\b(titrat\w*|up-?titrate|down-?titrate|increase by|decrease by)\b/i,
    },
    { name: 'sampling frequency', pattern: /\b(every|q)\s*\d+\s*(h|hours|hourly|minutes|min)\b/i },
    {
      name: 'alarm or threshold',
      pattern: /\b(alarm limit|threshold|cut-?off|upper limit|lower limit)\b/i,
    },
    { name: 'bare dosing verb', pattern: /\b(give|administer|infuse|bolus)\s+\d/i },
  ])

/**
 * Every learner-visible teaching string this section renders.
 *
 * The escalation boundary is excluded and asserted separately below: it is the one sentence whose
 * job is to *name* what the module does not carry, so "no quantity, no target" has to be allowed
 * to appear there and nowhere else.
 */
function renderedCitrateTeachingCopy(): readonly string[] {
  const strings: string[] = [CRRT_CITRATE_HELD_OPEN_NOTICE, CRRT_CITRATE_SCOPE_NOTICE]

  for (const step of crrtCitrateMechanismWalk()) {
    strings.push(
      step.traceOnTheCircuit,
      step.term.term,
      step.term.definition,
      step.term.whyItMatters,
    )
  }
  for (const category of crrtCitrateDifferentialCategories) {
    strings.push(
      category.name,
      category.notToBeConfusedWith,
      category.clinicalQuestion,
      category.samplingDomainWhy,
      category.whatOneFindingCannotEstablish,
    )
    for (const row of crrtCitrateComparisonRows) strings.push(row.read(category).statement)
  }
  return strings
}

describe('CRRT citrate mechanism', () => {
  it('reuses the authored circuit terms instead of defining citrate a second time', () => {
    const walk = crrtCitrateMechanismWalk()
    expect(walk).toHaveLength(crrtCitrateMechanismSteps.length)

    for (const step of walk) {
      // Identity, not equality: the walk points at the C0/C1 term object itself.
      expect(step.term).toBe(crrtCitrateCalciumTermById.get(step.termId))
    }
    // Every authored citrate term is used, so no definition is orphaned or duplicated.
    expect(walk.map((step) => step.termId).sort()).toEqual(
      crrtCitrateCalciumTerms.map((term) => term.id).sort(),
    )
  })

  it('teaches entry before the filter, the two domains, effluent loss, return, and replacement', () => {
    const walk = crrtCitrateMechanismWalk()
    const order = walk.map((step) => step.termId)

    expect(order[0]).toBe('citrate-entry-point')
    expect(order).toContain('circuit-anticoagulation')
    expect(order).toContain('citrate-calcium-in-effluent')
    expect(order).toContain('blood-returns-to-patient')
    expect(order).toContain('calcium-replacement')
    // The two sampling domains close the walk: they are the point of it.
    expect(order.slice(-2)).toEqual(['circuit-sample', 'systemic-sample'])
    expect(order.indexOf('citrate-entry-point')).toBeLessThan(
      order.indexOf('citrate-calcium-in-effluent'),
    )
  })

  it('makes the purpose of calcium replacement explicit', () => {
    const term = crrtCitrateCalciumTermById.get('calcium-replacement')
    expect(term?.definition).toMatch(/separate infusion running to the patient/i)
    expect(term?.whyItMatters).toMatch(/supports the patient rather than the circuit/i)
    expect(crrtCitrateComparisonTextEquivalent()).toMatch(/calcium has to be given back somewhere/i)
  })
})

describe('CRRT four-way citrate comparison', () => {
  it('carries all four categories, distinctly', () => {
    expect(crrtCitrateDifferentialCategories.map((category) => category.id)).toEqual([
      ...CRRT_CITRATE_DIFFERENTIAL_IDS,
    ])
    expect(new Set(crrtCitrateDifferentialCategories.map((c) => c.name)).size).toBe(4)
    expect(new Set(crrtCitrateDifferentialCategories.map((c) => c.clinicalQuestion)).size).toBe(4)
  })

  it('does not label citrate-related alkalosis as citrate accumulation', () => {
    const alkalosis = crrtCitrateDifferentialCategories.find(
      (category) => category.id === 'citrate-related-alkalosis',
    )!
    const accumulation = crrtCitrateDifferentialCategories.find(
      (category) => category.id === 'citrate-accumulation',
    )!

    expect(alkalosis.name).not.toMatch(/accumulation/i)
    expect(alkalosis.notToBeConfusedWith).toMatch(/not a synonym for citrate accumulation/i)
    expect(alkalosis.notToBeConfusedWith).toMatch(/not a stage of it/i)
    expect(accumulation.notToBeConfusedWith).toMatch(/must not be merged/i)
    expect(alkalosis.clinicalQuestion).not.toBe(accumulation.clinicalQuestion)
    // Entered through different axes: one through acid–base, one through the citrate load.
    expect(alkalosis.samplingDomain).toBe('systemic')
    expect(accumulation.samplingDomain).toBe('both-compared')
  })

  it('separates the circuit question from the patient question', () => {
    const byId = new Map(crrtCitrateDifferentialCategories.map((c) => [c.id, c]))
    expect(byId.get('insufficient-citrate-effect')?.samplingDomain).toBe('circuit')
    expect(byId.get('inadequate-calcium-replacement')?.samplingDomain).toBe('systemic')
    expect(byId.get('insufficient-citrate-effect')?.notToBeConfusedWith).toMatch(
      /not the same as inadequate calcium replacement/i,
    )
  })

  it('marks every field as either following from the circuit or held open', () => {
    for (const category of crrtCitrateDifferentialCategories) {
      for (const row of crrtCitrateComparisonRows) {
        const field = row.read(category)
        expect(['topology', 'held-open']).toContain(field.support)
        expect(field.statement.length).toBeGreaterThan(40)
      }
      expect(category.whatOneFindingCannotEstablish.length).toBeGreaterThan(40)
      expect(category.firstVerificationBoundary).toMatch(/responsible clinical team/i)
      expect(category.firstVerificationBoundary).toMatch(/authorised local protocol/i)
    }
  })

  it('holds the mechanism open where the registered sources do not carry it', () => {
    const byId = new Map(crrtCitrateDifferentialCategories.map((c) => [c.id, c]))
    // The two categories whose physiology the registered set does not state.
    expect(byId.get('citrate-accumulation')?.acidBaseContext.support).toBe('held-open')
    expect(byId.get('citrate-related-alkalosis')?.acidBaseContext.support).toBe('held-open')
    expect(byId.get('citrate-related-alkalosis')?.acidBaseContext.statement).toMatch(
      /do not state the mechanism/i,
    )
    // And the topology that is authored stays stated.
    expect(byId.get('insufficient-citrate-effect')?.circuitBehaviour.support).toBe('topology')
    expect(byId.get('inadequate-calcium-replacement')?.systemicCalciumContext.support).toBe(
      'topology',
    )
  })

  it('contains no dose, quantity, ratio, target, schedule, frequency, or threshold', () => {
    const findings = renderedCitrateTeachingCopy().flatMap((copy) =>
      PROHIBITED_QUANTITY_PATTERNS.filter((rule) => rule.pattern.test(copy)).map((rule) => ({
        rule: rule.name,
        copy,
      })),
    )
    expect(findings).toEqual([])

    // The escalation boundary is the one sentence allowed to name what is absent, and it does.
    for (const category of crrtCitrateDifferentialCategories) {
      expect(category.firstVerificationBoundary).toMatch(
        /this module carries no quantity, no target, and no adjustment/i,
      )
    }
  })

  it('gives every new clinical claim resolving CRRT provenance', () => {
    for (const category of crrtCitrateDifferentialCategories) {
      expect(category.sourceIds.length).toBeGreaterThan(0)
      for (const id of category.sourceIds) {
        expect(isResolvableCrrtSourceId(id)).toBe(true)
      }
      expect(category.sourceIds).toContain('SYNTH-LAB-CITRATE-001')
    }
    expect(unresolvedCrrtCitrateSourceIds()).toEqual([])
  })

  it('fails rather than quietly dropping an unknown evidence id', () => {
    expect(() => crrtCitrateMechanismWalk.call(null)).not.toThrow()
    // The module-scope closure check is the guard; prove it reports an unknown id rather than
    // silently returning an empty list.
    expect(unresolvedCrrtCitrateSourceIds()).toEqual([])
    expect(isResolvableCrrtSourceId('SYNTH-LAB-CITRATE-999')).toBe(false)
  })
})

describe('citrate section surface', () => {
  it('shows the mechanism walk and all four questions without relying on colour', () => {
    render(<CrrtCitrateDifferential />)

    const walk = crrtCitrateMechanismWalk()
    for (const step of walk) {
      expect(screen.getAllByText(step.term.term).length).toBeGreaterThan(0)
    }

    // Every category is named in the always-visible summary, not only in the open panel.
    const summary = screen.getByRole('list', { name: 'All four questions side by side' })
    expect(within(summary).getAllByRole('listitem')).toHaveLength(4)
    for (const category of crrtCitrateDifferentialCategories) {
      expect(within(summary).getByText(new RegExp(category.name, 'i'))).toBeInTheDocument()
    }
  })

  it('labels support in words, so the held-open rows are readable without the styling', () => {
    render(<CrrtCitrateDifferential initialCategoryId="citrate-related-alkalosis" />)

    expect(screen.getAllByText('Open question').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Follows from the circuit').length).toBeGreaterThan(0)
    // Once as prose on the page, and once inside the text equivalent.
    expect(
      screen.getAllByText(new RegExp(CRRT_CITRATE_HELD_OPEN_NOTICE.slice(0, 40))),
    ).toHaveLength(2)
  })

  it('opens each question from the keyboard-reachable picker with pressed state exposed', () => {
    render(<CrrtCitrateDifferential />)

    const picker = screen.getByRole('group', { name: 'Citrate comparison categories' })
    const buttons = within(picker).getAllByRole('button')
    expect(buttons).toHaveLength(4)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(buttons[3])
    expect(within(picker).getAllByRole('button')[3]).toHaveAttribute('aria-pressed', 'true')
    expect(within(picker).getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByRole('heading', { name: /Citrate-related metabolic alkalosis/ }),
    ).toBeInTheDocument()
  })

  it('carries a complete text equivalent covering every category and every held-open row', () => {
    const text = crrtCitrateComparisonTextEquivalent()

    for (const category of crrtCitrateDifferentialCategories) {
      expect(text).toContain(category.name)
      expect(text).toContain(category.clinicalQuestion)
      expect(text).toContain(category.whatOneFindingCannotEstablish)
      for (const row of crrtCitrateComparisonRows) {
        expect(text).toContain(row.read(category).statement)
      }
    }
    expect(text).toMatch(/open question, not answered by the sources registered for this module/)
    expect(text).toMatch(/follows from the circuit/)
    expect(text).toContain(CRRT_CITRATE_SCOPE_NOTICE)

    render(<CrrtCitrateDifferential />)
    // Available as text on the page, in a disclosure rather than only on hover.
    expect(screen.getByText('Read the whole comparison as text')).toBeInTheDocument()
  })

  it('states the scope limit rather than reading as a bedside algorithm', () => {
    render(<CrrtCitrateDifferential />)
    const scope = screen.getByRole('note')
    expect(scope).toHaveTextContent(/not a bedside algorithm/i)
    expect(scope).toHaveTextContent(/carries no quantity of any kind/i)
    expect(scope).toHaveTextContent(/replaces neither the authorised local protocol/i)
  })

  it('exposes no evidence-record id as primary learner copy', () => {
    render(<CrrtCitrateDifferential />)
    for (const id of [
      'SYNTH-LAB-CITRATE-001',
      'REVIEW-CKRT-CORE-2025',
      'TEXT-CRRT-NEYRA-2026',
      'GUID-RRT-ICU-2026',
    ]) {
      expect(screen.queryByText(id)).not.toBeInTheDocument()
    }
  })
})
