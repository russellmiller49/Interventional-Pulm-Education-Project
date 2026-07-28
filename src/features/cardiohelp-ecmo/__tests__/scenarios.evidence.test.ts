import { cardiohelpEvidence, validateEvidenceIds } from '../content/evidence'
import { cardiohelpLearnLessons, validateGuidedLessonRegistry } from '../content/learnLessons'
import {
  cardiohelpCapstonePrerequisiteIds,
  cardiohelpCapstonePrerequisiteIdsBySupportMode,
  cardiohelpScenarios,
  cardiohelpScenariosBySupportMode,
  isCardiohelpCapstoneUnlocked,
  validateScenarioRegistry,
} from '../content/scenarios'

describe('CARDIOHELP ECMO scenario and evidence registries', () => {
  it('has an internally valid graph and all required scenario families', () => {
    expect(validateScenarioRegistry()).toEqual([])
    const families = new Set(cardiohelpScenarios.map((scenario) => scenario.family))
    expect(families).toEqual(
      new Set([
        'orientation',
        'preload',
        'afterload',
        'recirculation',
        'sweep',
        'gas-source',
        'bubble',
        'transport',
        'differential-oxygenation',
        'ventricular-loading',
        'capstone',
      ]),
    )
    expect(
      cardiohelpScenarios.find((scenario) => scenario.id === 'vv-off-sweep-capstone'),
    ).toMatchObject({
      family: 'capstone',
      supportMode: 'vv',
    })
    expect(
      cardiohelpScenarios.find((scenario) => scenario.id === 'vv-off-sweep-capstone'),
    ).not.toHaveProperty('hiddenUntilAssessment')
  })

  it('preserves the legacy recommendation helper without using it as a route gate', () => {
    expect(isCardiohelpCapstoneUnlocked([])).toBe(false)
    expect(isCardiohelpCapstoneUnlocked(cardiohelpCapstonePrerequisiteIds)).toBe(true)
    expect(
      isCardiohelpCapstoneUnlocked(cardiohelpCapstonePrerequisiteIdsBySupportMode.vv, 'va'),
    ).toBe(false)
    expect(
      isCardiohelpCapstoneUnlocked(cardiohelpCapstonePrerequisiteIdsBySupportMode.va, 'va'),
    ).toBe(true)
    expect(
      isCardiohelpCapstoneUnlocked(cardiohelpCapstonePrerequisiteIdsBySupportMode.va, 'vv'),
    ).toBe(false)
  })

  it('keeps VV and VA scenario registries isolated with stable namespaced IDs', () => {
    expect(
      cardiohelpScenariosBySupportMode.vv.every((scenario) => scenario.supportMode === 'vv'),
    ).toBe(true)
    expect(
      cardiohelpScenariosBySupportMode.va.every((scenario) => scenario.supportMode === 'va'),
    ).toBe(true)
    expect(
      cardiohelpScenariosBySupportMode.va.every((scenario) => scenario.id.startsWith('va-')),
    ).toBe(true)
    expect(
      cardiohelpScenariosBySupportMode.vv.some(
        (scenario) => scenario.id === 'vv-off-sweep-capstone',
      ),
    ).toBe(true)
    expect(
      cardiohelpScenariosBySupportMode.va.some(
        (scenario) => scenario.id === 'va-mixed-circulation-capstone',
      ),
    ).toBe(true)
  })

  it('resolves every evidence ID and preserves the explicit source boundary', () => {
    for (const scenario of cardiohelpScenarios) {
      expect(validateEvidenceIds(scenario.evidenceIds)).toBe(true)
    }
    expect(new Set(cardiohelpEvidence.map((item) => item.sourceClass))).toEqual(
      new Set(['manufacturer', 'clinical-guidance', 'textbook', 'educational-model']),
    )
  })

  it('does not encode disputed bubble thresholds or delta-p alarm priority', () => {
    const serialized = JSON.stringify({
      cardiohelpScenarios,
      cardiohelpEvidence,
    }).toLocaleLowerCase()
    expect(serialized).not.toMatch(/bubble.{0,40}(?:≥|<=|at least|threshold).{0,20}5\s*mm/)
    expect(serialized).not.toMatch(/delta.?p.{0,40}(?:low|medium|high)[ -]?priority alarm/)
  })

  it('provides a valid guided walkthrough for every non-capstone scenario', () => {
    expect(validateGuidedLessonRegistry()).toEqual([])
    const eligibleScenarioIds = cardiohelpScenarios
      .filter((scenario) => scenario.family !== 'capstone')
      .map((scenario) => scenario.id)
    expect(cardiohelpLearnLessons.map((lesson) => lesson.scenarioId)).toEqual(eligibleScenarioIds)
    expect(
      cardiohelpLearnLessons.some((lesson) => lesson.scenarioId === 'vv-off-sweep-capstone'),
    ).toBe(false)
    expect(
      cardiohelpLearnLessons.some(
        (lesson) => lesson.scenarioId === 'va-mixed-circulation-capstone',
      ),
    ).toBe(false)
    for (const lesson of cardiohelpLearnLessons) {
      const scenario = cardiohelpScenarios.find((item) => item.id === lesson.scenarioId)
      expect(lesson.supportMode).toBe(scenario?.supportMode)
    }
  })

  it('uses a distinct authored scenario and observable action for every transfer phase', () => {
    const transfers = cardiohelpLearnLessons.map((lesson) => ({
      lesson,
      transfer: lesson.steps.find((step) => step.phase === 'transfer'),
    }))
    expect(transfers).toHaveLength(20)
    expect(new Set(transfers.map(({ transfer }) => transfer?.transferVariantId)).size).toBe(20)

    for (const { lesson, transfer } of transfers) {
      expect(transfer?.transferScenarioId).toBeTruthy()
      expect(transfer?.transferScenarioId).not.toBe(lesson.scenarioId)
      expect(transfer?.actions).toHaveLength(1)
      expect(transfer?.actionLabel).not.toMatch(/finish|mark complete|acknowledge completion/i)
      const variantScenario = cardiohelpScenarios.find(
        (scenario) => scenario.id === transfer?.transferScenarioId,
      )
      expect(variantScenario?.supportMode).toBe(lesson.supportMode)
    }
  })

  it('keeps unsafe shortcuts out of Learn and orders bubble correction before reset', () => {
    const actions = cardiohelpLearnLessons.flatMap((lesson) =>
      lesson.steps.flatMap((item) => item.actions),
    )
    expect(actions.some((action) => action.type === 'TOGGLE_GLOBAL_OVERRIDE')).toBe(false)

    const preload = cardiohelpLearnLessons.find(
      (lesson) => lesson.scenarioId === 'preload-drainage-collapse',
    )!
    const rpmActions = preload.steps
      .flatMap((item) => item.actions)
      .filter((action) => action.type === 'SET_RPM')
    expect(rpmActions).toEqual([{ type: 'SET_RPM', rpm: 3300 }])

    const bubbleActions = cardiohelpLearnLessons
      .find((lesson) => lesson.scenarioId === 'arterial-bubble-stop')!
      .steps.flatMap((item) => item.actions)
    const correctionIndex = bubbleActions.findIndex(
      (action) => action.type === 'CORRECT_FAULT' && action.fault === 'arterial-bubble',
    )
    expect(correctionIndex).toBeGreaterThanOrEqual(0)
    expect(bubbleActions.findIndex((action) => action.type === 'RESET_BUBBLE')).toBeGreaterThan(
      correctionIndex,
    )
  })
})
