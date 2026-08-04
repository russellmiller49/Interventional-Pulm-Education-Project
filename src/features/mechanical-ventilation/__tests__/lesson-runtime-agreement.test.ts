import { mechanicalVentilationLessonItems } from '../content/lessonLearningItems'
import {
  ventilationLessonAttempt,
  ventilationLessonRuntimeById,
  type VentilationLessonRuntimeVariant,
  type VentilationLessonVariant,
} from '../content/lessonRuntime'
import { createInitialSimulationState, ventilationSimulationReducer } from '../engine'
import type { VentilationSimulationState } from '../engine'

/**
 * Does the patient in front of the learner do what the credited answer says?
 *
 * Every assertion here is taken at the *exact* point the learner reads the result.
 * `MechanicalVentilationLessonActivity` builds the session with `paused: false`, the learner
 * dispatches the variant's guided actions, and `runResponse` then fires a single
 * `TICK { seconds: responseSeconds }`. Sampling anywhere else measures a patient the learner never
 * sees — the earlier audit of this module reached the wrong conclusion twice by doing exactly that.
 */
function observationPoint(lessonId: string, variant: VentilationLessonVariant) {
  const runtime = ventilationLessonRuntimeById.get(lessonId)
  if (!runtime) throw new Error(`No runtime for ${lessonId}`)
  const definition: VentilationLessonRuntimeVariant = runtime[variant]
  const attempt = ventilationLessonAttempt(definition, variant === 'primary' ? 1 : 2)

  let state: VentilationSimulationState = {
    ...createInitialSimulationState(definition.caseId, 'learn', attempt, 'hamilton-c6'),
    paused: false,
  }
  const before = {
    measurements: { ...state.measurements },
    patient: JSON.parse(JSON.stringify(state.patient)) as VentilationSimulationState['patient'],
  }
  for (const action of definition.actions) {
    state = ventilationSimulationReducer(state, action.resolve(state))
  }
  state = ventilationSimulationReducer(state, {
    type: 'TICK',
    seconds: definition.responseSeconds,
  })
  return { definition, attempt, before, after: state }
}

describe('oxygenation-response: the credited prediction against what the patient does', () => {
  /**
   * The defect: the guided step was PEEP 5 → 7, and the modelled recruitment window opens at a set
   * PEEP of 8. Oxygenation improved because the shunt term responds continuously, but compliance
   * and the shunt fraction did not move at all and the plateau rose *with the baseline* — so the
   * lesson credited a recruitment prediction over a patient that had not recruited. The step is now
   * 5 → 8, and these hold it there.
   */
  const { after, before, definition } = observationPoint('oxygenation-response', 'primary')

  it('reaches the modelled recruitment window', () => {
    expect(definition.caseId).toBe('MV-01')
    expect(after.ventilator.settings.peepCmH2O).toBeGreaterThanOrEqual(8)
  })

  it('improves oxygenation', () => {
    expect(after.patient.gasExchange.spo2Percent).toBeGreaterThan(
      before.patient.gasExchange.spo2Percent + 1,
    )
    // Recruitment in this model is a fall in shunt, not merely a higher saturation.
    expect(after.patient.gasExchange.shuntFraction).toBeLessThan(
      before.patient.gasExchange.shuntFraction - 0.01,
    )
  })

  /**
   * The claim the explanation actually makes: *the same tidal volume now arrives for less pressure.*
   * Both halves are asserted, because either alone is compatible with the defect — a plateau can
   * fall because the breath got smaller, and a volume can hold while pressure climbs.
   */
  it('delivers the same breath at a lower pressure cost', () => {
    expect(after.measurements.exhaledVtMl).toBeCloseTo(before.measurements.exhaledVtMl, 0)
    expect(after.measurements.peakPressureCmH2O).toBeLessThan(before.measurements.peakPressureCmH2O)
    expect(after.measurements.plateauPressureCmH2O).toBeLessThan(
      before.measurements.plateauPressureCmH2O,
    )
  })

  /**
   * The explanation says the mean arterial pressure does not move here, and gives that as the
   * reason to look rather than as a reason to skip it. If the model ever starts moving it, the copy
   * is wrong and should fail.
   */
  it('leaves the mean arterial pressure where it was, as the copy states', () => {
    expect(after.patient.hemodynamics.mapMmHg).toBeCloseTo(before.patient.hemodynamics.mapMmHg, 1)
  })

  it('credits no signal the copy does not name', () => {
    const item = mechanicalVentilationLessonItems['oxygenation-response'].prediction
    const credited = item.choices.find((choice) => choice.id === item.correctChoiceIds[0])
    const copy = `${credited?.label} ${credited?.rationale} ${item.explanation}`
    // Compliance is model truth rather than something this patient's trace reveals — the plateau it
    // would be computed from is not interpretable here — so the copy must not lean on it.
    expect(copy).not.toMatch(/\bcompliance\b/i)
  })
})

describe('waveform-reading-sequence: the named finding is actually present', () => {
  /**
   * The defect: the stem names condensate at the flow sensor, and MV-08 selects
   * `cardiogenic-oscillation` on attempts 1, 2 and 4 — so on a learner's first two runs the finding
   * the question is built on did not exist. The variant now pins the branch.
   */
  const { after, definition, attempt } = observationPoint('waveform-reading-sequence', 'transfer')

  it('loads the branch the question names', () => {
    expect(definition.caseId).toBe('MV-08')
    expect(definition.branch).toBe('condensate')
    expect(after.branch).toBe('condensate')
  })

  it('puts condensate in the circuit, not merely in the prose', () => {
    expect(after.patient.airway.condensate).toBe(true)
  })

  it('still autotriggers, so the mechanism the lesson teaches is intact', () => {
    expect(after.measurements.autotriggerFraction).toBeGreaterThan(0)
  })

  it('resolves deterministically, whatever attempt the learner is on', () => {
    for (const requested of [1, 2, 3, 7, 12]) {
      expect(ventilationLessonAttempt(definition, requested)).toBe(attempt)
    }
  })

  it('leaves every other variant free to vary', () => {
    const pinned = [...ventilationLessonRuntimeById.values()].flatMap((runtime) =>
      (['primary', 'transfer'] as const)
        .filter((variant) => runtime[variant].branch)
        .map((variant) => `${runtime.lessonId}:${variant}`),
    )
    expect(pinned).toEqual(['waveform-reading-sequence:transfer'])
  })
})

describe('triggering-and-cycling: the cycling threshold is the active determinant', () => {
  /**
   * The defect: the authored step raised the cycling threshold by ten points, and MV-10's time
   * constant is 1.76 s — so the flow-cycle criterion needed 4.05 s at 10 % and 2.83 s at 20 %, both
   * beyond the 1.5 s `tiMaxSeconds` backstop. Mechanical inspiratory time read exactly 1.50 s before
   * and after, while the credited answer asked the learner to reassess it.
   */
  const { after, before } = observationPoint('triggering-and-cycling', 'transfer')
  const settings = after.ventilator.settings as { tiMaxSeconds?: number; etsPercent?: number }

  it('shortens the mechanical breath', () => {
    expect(after.measurements.mechanicalInspiratoryTimeSeconds).toBeLessThan(
      before.measurements.mechanicalInspiratoryTimeSeconds - 0.1,
    )
  })

  /** The assertion that would have caught this: the cap must not be what ends the breath. */
  it('is not masked by the tiMax backstop', () => {
    const tiMax = settings.tiMaxSeconds ?? Number.POSITIVE_INFINITY
    expect(before.measurements.mechanicalInspiratoryTimeSeconds).toBeCloseTo(tiMax, 1)
    expect(after.measurements.mechanicalInspiratoryTimeSeconds).toBeLessThan(tiMax - 0.05)
  })

  it('gives the expiratory limb the time back', () => {
    expect(after.measurements.intrinsicPeepCmH2O).toBeLessThan(
      before.measurements.intrinsicPeepCmH2O - 0.5,
    )
    // Less gas still moving when the next breath arrives — the flow is negative, so this rises.
    expect(after.measurements.expiratoryFlowAtNextBreathLMin).toBeGreaterThan(
      before.measurements.expiratoryFlowAtNextBreathLMin,
    )
  })

  it('does not overcorrect into premature cycling', () => {
    // The breath should still outlast the patient's own inspiration; this is an improvement, not a fix.
    expect(after.measurements.mechanicalInspiratoryTimeSeconds).toBeGreaterThan(0.5)
  })
})

describe('the expiratory-flow sign convention', () => {
  /**
   * The module states its own convention in `waveform-anatomy`: flow is signed, in above the line
   * and out below it. So expiratory flow that has not finished is *below* zero, and copy describing
   * incomplete emptying as flow "above zero" inverts the trace the learner is looking at.
   */
  const learnerCopy = Object.entries(mechanicalVentilationLessonItems).flatMap(
    ([lessonId, items]) =>
      (['prediction', 'transfer'] as const).flatMap((phase) => {
        const item = items[phase]
        return [
          { where: `${lessonId}:${phase}:stem`, text: item.stem },
          { where: `${lessonId}:${phase}:explanation`, text: item.explanation },
          ...item.choices.flatMap((choice) => [
            { where: `${lessonId}:${phase}:${choice.id}:label`, text: choice.label },
            { where: `${lessonId}:${phase}:${choice.id}:rationale`, text: choice.rationale },
          ]),
        ]
      }),
  )

  it('never describes expiratory flow as being above zero', () => {
    const offenders = learnerCopy.filter(({ text }) =>
      /expiratory flow[^.]{0,60}\babove zero\b/i.test(text),
    )
    expect(offenders).toEqual([])
  })

  it('describes incomplete emptying as not having returned to zero', () => {
    const item = mechanicalVentilationLessonItems['ventilation-and-co2'].transfer
    expect(item.stem).toMatch(/has not returned to zero before the next inspiration/i)
  })

  it('agrees with the sign the model actually reports', () => {
    const { after } = observationPoint('ventilation-and-co2', 'transfer')
    // MV-06 is still emptying when the next breath begins, and that reads negative.
    expect(after.measurements.expiratoryFlowAtNextBreathLMin).toBeLessThan(0)
  })
})

describe('the capstone credits stabilization only on an unstable patient', () => {
  /**
   * "Relieve the trapped gas first" is defensible because the circulation is failing, not because
   * trapping is present. If the runtime ever stops being an unstable obstructive-shock patient, the
   * credited priority stops being the right one and this should say so.
   */
  const { after, definition } = observationPoint('high-peak-pressure-integration', 'transfer')

  it('loads a patient in obstructive shock', () => {
    expect(definition.caseId).toBe('MV-06')
    expect(after.patient.hemodynamics.mapMmHg).toBeLessThan(65)
    expect(after.measurements.intrinsicPeepCmH2O).toBeGreaterThan(15)
    expect(after.measurements.expiratoryFlowAtNextBreathLMin).toBeLessThan(-5)
  })

  it('separates immediate stabilization from measurement and from definitive correction', () => {
    const item = mechanicalVentilationLessonItems['high-peak-pressure-integration'].transfer
    const credited = item.choices.find((choice) => choice.id === 'release-trapped-gas')
    expect(item.correctChoiceIds).toEqual(['release-trapped-gas'])
    expect(credited?.rationale).toMatch(/immediate stabilizing act, not the diagnosis/i)
    expect(item.explanation).toMatch(/immediate stabilization/i)
    expect(item.explanation).toMatch(/definitive correction/i)
  })
})
