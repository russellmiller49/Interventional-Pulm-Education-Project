import { render, screen } from '@testing-library/react'

import { BedsidePanel } from '../components/BedsidePanel'
import { CaseWorkflow, shouldRenderVentilationCalibration } from '../components/CaseWorkflow'
import { mechanicalVentilationCaseById } from '../content'
import { branchResolution, classifyCaseFindings } from '../content/caseFindings'
import { createInitialSimulationState, type VentilationSimulationState } from '../engine'

function definitionFor(caseId: string) {
  const definition = mechanicalVentilationCaseById.get(caseId)
  if (!definition) throw new Error(`Expected ${caseId}`)
  return definition
}

function debriefState(caseId: string, branch?: string): VentilationSimulationState {
  const state = createInitialSimulationState(caseId, 'practice', 1, 'hamilton-c6')
  return { ...state, phase: 'debrief', ...(branch ? { branch } : {}) }
}

function renderDebrief(caseId: string, branch?: string) {
  const definition = definitionFor(caseId)
  return render(
    <CaseWorkflow
      state={debriefState(caseId, branch)}
      definition={definition}
      dispatch={jest.fn()}
      onResult={jest.fn()}
    />,
  )
}

/**
 * What the learner sees when the case is over.
 *
 * The debrief used to open, in Learn, on a block headed "Educator mechanics and hidden risk
 * record" containing the reproducibility key, the internal branch token, six risk accumulators and
 * a ring-buffer depth. For eleven of the fifteen cases that token is a one-element constant, so it
 * was a bare answer key printed under the question.
 */
describe('the learner-facing case debrief', () => {
  const softwareInternals = [
    /Educator mechanics/i,
    /hidden risk record/i,
    /Plateau burden/i,
    /Stacked-volume burden/i,
    /Hyperinflation burden/i,
    /Hypoxemia burden/i,
    /Hypotension burden/i,
    /Sedation burden/i,
    /Buffer/i,
    /\/ 600 samples/i,
  ]

  it.each(['MV-01', 'MV-08', 'MV-11', 'MV-13', 'MV-15'])(
    'carries no seed, burden, or buffer metadata for %s',
    (caseId) => {
      const { container } = renderDebrief(caseId)
      const text = container.textContent ?? ''
      for (const pattern of softwareInternals) {
        expect(text).not.toMatch(pattern)
      }
    },
  )

  /**
   * The branch is the lookup key for the explanation and must never be the explanation. MV-11's
   * token is `rise-time-mismatch` — the mechanism the learner was asked to name.
   *
   * Only the hyphenated tokens are checked as strings, and deliberately: MV-08's `leak` and
   * `condensate` are also ordinary clinical words that belong in the case title, the intervention
   * labels and the authored debrief. Banning the word would ban the vocabulary; what must not
   * appear is the identifier, and every identifier that is distinguishable from prose is hyphenated.
   * The un-hyphenated ones are covered by the metadata assertions above, which prove the raw branch
   * is no longer printed as a field at all.
   */
  it.each([
    ['MV-13', 'hme-or-ett'],
    ['MV-08', 'cardiogenic-oscillation'],
    ['MV-11', 'rise-time-mismatch'],
    ['MV-15', 'pain-bladder-delirium'],
    ['MV-04', 'entrainment-1:1'],
    ['MV-05', 'pressure-support-dominant'],
  ])('never prints %s’s internal branch token %s', (caseId, branch) => {
    const { container } = renderDebrief(caseId, branch)
    expect(container.textContent ?? '').not.toContain(branch)
  })

  /** And the raw value is not rendered anywhere, whatever it happens to be spelled like. */
  it.each(['MV-01', 'MV-04', 'MV-05', 'MV-08', 'MV-13', 'MV-14'])(
    'renders no field whose value is %s’s branch token',
    (caseId) => {
      const definition = definitionFor(caseId)
      for (const branch of definition.branchOptions) {
        const { container, unmount } = renderDebrief(caseId, branch)
        const exactMatches = Array.from(container.querySelectorAll('dd, dt, span, li, p')).filter(
          (node) => node.textContent?.trim() === branch,
        )
        expect(exactMatches).toEqual([])
        unmount()
      }
    },
  )

  it('says what the patient turned out to have, in words rather than a token', () => {
    renderDebrief('MV-13', 'hme-or-ett')
    expect(screen.getByText('What this patient turned out to have')).toBeInTheDocument()
    expect(
      screen.getByText(/The tube itself, or the filter on the end of it, was obstructed/i),
    ).toBeInTheDocument()
  })

  /**
   * The point of the branch: the same action moves the numbers in one version and not in another,
   * and the learner is owed the reason rather than a shrug.
   */
  it('explains why the numbers stayed put when the action did not fit the cause', () => {
    renderDebrief('MV-13', 'bronchospasm')
    expect(screen.getByText('Why the numbers stayed where they were')).toBeInTheDocument()
    expect(
      screen.getByText(/not in the tube and not from material that could be suctioned/i),
    ).toBeInTheDocument()
  })

  it('explains why they moved when it did', () => {
    const definition = definitionFor('MV-13')
    const base = debriefState('MV-13', 'bronchospasm')
    const bronchodilator = definition.interventions.find((item) => item.id === 'bronchodilator')
    expect(bronchodilator).toBeDefined()
    render(
      <CaseWorkflow
        state={{
          ...base,
          interventions: [
            {
              id: 'record-bronchodilator',
              interventionId: 'bronchodilator',
              label: bronchodilator?.label ?? 'Bronchodilator',
              response: bronchodilator?.response ?? '',
              time: 30,
              effectiveAt: 330,
            },
          ],
        }}
        definition={definition}
        dispatch={jest.fn()}
        onResult={jest.fn()}
      />,
    )
    expect(screen.getByText('Why the numbers moved')).toBeInTheDocument()
    expect(screen.getByText(/Relaxing the airway muscle widened the airways/i)).toBeInTheDocument()
  })

  it('renders no cause block for a case whose branch changes nothing', () => {
    const { container } = renderDebrief('MV-01')
    expect(container.textContent ?? '').not.toContain('What this patient turned out to have')
  })

  it('keeps the hidden-model record behind the build-environment gate', () => {
    expect(shouldRenderVentilationCalibration('development')).toBe(true)
    expect(shouldRenderVentilationCalibration('production')).toBe(false)
    expect(shouldRenderVentilationCalibration('test')).toBe(false)
    expect(shouldRenderVentilationCalibration(undefined)).toBe(false)
  })
})

/**
 * The differential is a menu; this patient has one of them.
 *
 * MV-13's authored findings name all three candidate causes at once, each prefixed with its own
 * internal branch name, and they were listed as peers of the findings that are actually present.
 */
describe('possible findings against present findings', () => {
  it('classifies every authored finding, and only within range', () => {
    for (const [caseId, definition] of mechanicalVentilationCaseById) {
      const classified = classifyCaseFindings(caseId)
      expect(classified).toHaveLength(definition.visibleFindings.length)
      expect(classified.map((finding) => finding.text)).toEqual([...definition.visibleFindings])
    }
  })

  it('marks MV-13’s three candidate causes as a differential rather than as findings', () => {
    const classified = classifyCaseFindings('MV-13')
    expect(classified[0].kind).toBe('present')
    expect(classified.slice(1).every((finding) => finding.kind === 'byBranch')).toBe(true)
  })

  it('separates them at the bedside instead of listing them as peers', () => {
    render(
      <BedsidePanel
        state={createInitialSimulationState('MV-13', 'learn', 1, 'hamilton-c6')}
        definition={definitionFor('MV-13')}
      />,
    )
    expect(screen.getByText(/Still open:/i)).toBeInTheDocument()
    expect(screen.getByText(/one of these fits this patient/i)).toBeInTheDocument()
  })

  it('marks a finding that only appears in response to an action', () => {
    render(
      <BedsidePanel
        state={createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')}
        definition={definitionFor('MV-01')}
      />,
    )
    expect(screen.getByText(/Only if you look:/i)).toBeInTheDocument()
  })

  it('authors a resolution for every branch of every case that has one', () => {
    for (const caseId of ['MV-13', 'MV-08']) {
      const definition = definitionFor(caseId)
      for (const branch of definition.branchOptions) {
        const resolution = branchResolution(caseId, branch)
        expect(resolution).not.toBeNull()
        // The prose must not smuggle a hyphenated identifier back in.
        if (branch.includes('-')) {
          expect(
            `${resolution?.cause} ${resolution?.whenAddressed} ${resolution?.whenNotAddressed}`,
          ).not.toContain(branch)
        }
      }
    }
  })
})
