import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { ECMO_CONTROL_PANEL } from '../content/controlPanel'
import { orderedLessonScenarioIds } from '../content/curriculum'
import {
  deriveKnobStrip,
  ecmoDrillFamilyForScenario,
  ecmoDrillSpec,
  ecmoDrillSpecs,
  ecmoDrillSpecsForSupportMode,
  ecmoKnobStripClauses,
  ecmoLocalizationRowIdForFamily,
  validateEcmoDrillSpecs,
  type EcmoDrillSpec,
} from '../content/drillSpecs'
import { evidenceById } from '../content/evidence'
import { requireEcmoLearnPrediction } from '../content/learnPredictionItems'
import { ecmoLocalizationRow } from '../content/localizationCards'
import { cardiohelpScenarioById } from '../content/scenarios'
import type { SupportMode } from '../engine/types'

/**
 * The per-drill shapes, checked as authored content.
 *
 * The strip is the piece with two owners — it is authored so a reviewer can read it beside its
 * sentence, and derived so a scenario edit cannot leave it saying something the drill no longer
 * does. Most of what follows is about that pair staying one thing, and about the deny patterns
 * denying the answer the drill actually keys on rather than a phrase that sounds like it.
 */

const MODES: readonly SupportMode[] = ['vv', 'va']
const DRILL_IDS = MODES.flatMap((mode) => orderedLessonScenarioIds(mode))

/** The eight drills the diagnostic grammar has a row for, and the row each one takes. */
const ROW_BY_DRILL = {
  'preload-drainage-collapse': 'drainage-limitation',
  'va-preload-drainage-collapse': 'drainage-limitation',
  'afterload-return-obstruction': 'return-path-resistance',
  'va-afterload-arterial-return-obstruction': 'return-path-resistance',
  'afterload-oxygenator-resistance': 'membrane-resistance',
  'va-afterload-oxygenator-resistance': 'membrane-resistance',
  'gas-source-interruption': 'gas-path-failure',
  'va-gas-source-interruption': 'gas-path-failure',
} as const

function learnerFacingStrings(definition: EcmoDrillSpec): readonly string[] {
  return [definition.controlPanel.sentence, definition.transferPrinciple]
}

describe('every drill has a spec, and nothing else does', () => {
  it('registers one per drill, twenty in all, keyed by scenario id', () => {
    expect(DRILL_IDS).toHaveLength(20)
    expect(Object.keys(ecmoDrillSpecs).sort()).toEqual([...DRILL_IDS].sort())
    for (const id of DRILL_IDS) expect(ecmoDrillSpec(id).scenarioId).toBe(id)
  })

  it('registers no spec for either capstone', () => {
    expect(Object.keys(ecmoDrillSpecs)).not.toContain('vv-off-sweep-capstone')
    expect(Object.keys(ecmoDrillSpecs)).not.toContain('va-mixed-circulation-capstone')
  })

  it('gives each track its ten, in the order the track teaches them', () => {
    for (const mode of MODES) {
      const specs = ecmoDrillSpecsForSupportMode(mode)
      expect(specs).toHaveLength(10)
      expect(specs.map((definition) => definition.scenarioId).sort()).toEqual(
        [...orderedLessonScenarioIds(mode)].sort(),
      )
    }
  })

  it('validates cleanly at import and by explicit call', () => {
    expect(validateEcmoDrillSpecs()).toEqual([])
  })

  it('throws rather than returning undefined for a drill that does not exist', () => {
    expect(() => ecmoDrillSpec('vv-off-sweep-capstone')).toThrow(/vv-off-sweep-capstone/)
  })

  it('is never shown before the learner commits', () => {
    for (const id of DRILL_IDS) expect(ecmoDrillSpec(id).precommitVisibility).toBe('never')
  })
})

describe('the authored knob strip is the derived one', () => {
  it.each(DRILL_IDS)('%s: authored states equal the derivation', (id) => {
    const scenario = cardiohelpScenarioById.get(id)
    if (!scenario) throw new Error(`No scenario ${id}`)
    const derived = deriveKnobStrip(scenario, requireEcmoLearnPrediction(id))
    const authored: Record<string, unknown> = { ...ecmoDrillSpec(id).controlPanel }
    delete authored.sentence
    expect(authored).toEqual({ ...derived })
  })

  it('names the knob the expectation names, with the expectation direction', () => {
    for (const id of DRILL_IDS) {
      const scenario = cardiohelpScenarioById.get(id)
      if (!scenario) throw new Error(`No scenario ${id}`)
      const strip = ecmoDrillSpec(id).controlPanel
      const control = scenario.expectation.control
      if (control === 'rpm') expect(strip.pumpSpeed).toBe('this-knob')
      if (control === 'sweep') expect(strip.sweep).toBe('this-knob')
      if (control === 'gas-fio2') expect(strip.oxygenFraction).toBe('this-knob')

      if (strip.verdict === 'this-knob') {
        expect(strip.direction).toBe(scenario.expectation.direction)
      } else {
        expect(strip.direction).toBeUndefined()
      }
    }
  })

  it('marks the knob the drill unsafe choice reaches for, where that knob is not the answer', () => {
    // The reflex this module interrupts most often: reaching for speed against something speed
    // cannot fix. Nine of the twenty drills key on exactly that.
    const reflexes = DRILL_IDS.filter(
      (id) => ecmoDrillSpec(id).controlPanel.pumpSpeed === 'harmful-reflex',
    )
    expect(reflexes.length).toBeGreaterThan(0)
    for (const id of reflexes) {
      const prediction = requireEcmoLearnPrediction(id)
      const unsafe = prediction.item.choices.filter((choice) => choice.plausibility === 'unsafe')
      expect(unsafe.length).toBeGreaterThan(0)
      expect(unsafe.some((choice) => prediction.commitments[choice.id]?.control === 'rpm')).toBe(
        true,
      )
    }
  })

  it('treats the sweep drills where the reflex is the same knob as this-knob, not as a reflex', () => {
    // A strip cannot say both of one knob. In the two sweep drills the unsafe choice commits the
    // right knob in the wrong direction, which the direction — not the state — is what carries.
    for (const id of ['acute-hypercapnia', 'compensated-hypercapnia'] as const) {
      expect(ecmoDrillSpec(id).controlPanel.sweep).toBe('this-knob')
    }
    expect(ecmoDrillSpec('acute-hypercapnia').controlPanel.direction).toBe('increase')
    expect(ecmoDrillSpec('compensated-hypercapnia').controlPanel.direction).toBe('hold')
  })

  it('reaches for the clamps in the air drills and nowhere else', () => {
    for (const id of DRILL_IDS) {
      const scenario = cardiohelpScenarioById.get(id)
      const strip = ecmoDrillSpec(id).controlPanel
      const isBubble = scenario?.family === 'bubble'
      expect(`${id}: ${strip.clamps}`).toBe(
        `${id}: ${isBubble ? 'this-emergency' : 'emergency-only'}`,
      )
      expect(`${id}: ${strip.verdict}`).toBe(
        `${id}: ${isBubble ? 'no-knob-isolate-first' : strip.verdict}`,
      )
      // While the intervention holds the pump stopped, the speed setting is not a control at all.
      if (isBubble) expect(strip.pumpSpeed).toBe('not-a-control')
    }
  })

  it('walks the panel in the same order and grammar in every drill', () => {
    for (const id of DRILL_IDS) {
      const clauses = ecmoKnobStripClauses(ecmoDrillSpec(id).controlPanel.sentence)
      expect(`${id}: ${clauses === null ? 'off grammar' : 'on grammar'}`).toBe(`${id}: on grammar`)
    }
  })

  it('says no knob answers it wherever no knob does', () => {
    for (const id of DRILL_IDS) {
      const strip = ecmoDrillSpec(id).controlPanel
      const saysNoKnob = /No knob answers/.test(strip.sentence)
      expect(`${id}: ${saysNoKnob}`).toBe(`${id}: ${strip.verdict === 'no-knob-find-the-cause'}`)
    }
  })
})

describe('the grammar row a drill highlights', () => {
  it('is present for exactly the four pressure and gas families, in both tracks', () => {
    for (const id of DRILL_IDS) {
      const expected = (ROW_BY_DRILL as Record<string, string | undefined>)[id]
      expect(`${id}: ${ecmoDrillSpec(id).localizationRowId}`).toBe(`${id}: ${expected}`)
    }
    expect(Object.keys(ROW_BY_DRILL)).toHaveLength(8)
  })

  it('takes the row whose drill family is the scenario family', () => {
    for (const id of Object.keys(ROW_BY_DRILL)) {
      const scenario = cardiohelpScenarioById.get(id)
      if (!scenario) throw new Error(`No scenario ${id}`)
      const family = ecmoDrillFamilyForScenario(scenario)
      expect(family).not.toBeNull()
      const rowId = ecmoDrillSpec(id).localizationRowId
      expect(rowId).toBeDefined()
      if (!rowId || !family) return
      expect(ecmoLocalizationRow(rowId).drillFamily).toBe(family)
      expect(rowId).toBe(ecmoLocalizationRowIdForFamily(family))
    }
  })

  it('tells the two afterload drills apart by the fault they correct, as the grammar does', () => {
    // The scenario registry files both under `afterload`; the grammar has a separate row for each.
    for (const id of ['afterload-return-obstruction', 'va-afterload-arterial-return-obstruction']) {
      const scenario = cardiohelpScenarioById.get(id)
      expect(scenario?.family).toBe('afterload')
      expect(ecmoDrillFamilyForScenario(scenario!)).toBe('return-obstruction')
    }
    for (const id of ['afterload-oxygenator-resistance', 'va-afterload-oxygenator-resistance']) {
      const scenario = cardiohelpScenarioById.get(id)
      expect(scenario?.family).toBe('afterload')
      expect(ecmoDrillFamilyForScenario(scenario!)).toBe('oxygenator-resistance')
    }
  })

  it('leaves the other twelve drills without a row, because the grammar has none for them', () => {
    const without = DRILL_IDS.filter((id) => ecmoDrillSpec(id).localizationRowId === undefined)
    expect(without).toHaveLength(12)
    for (const id of without) {
      const scenario = cardiohelpScenarioById.get(id)
      expect(ecmoDrillFamilyForScenario(scenario!)).toBeNull()
    }
  })
})

describe('the deny patterns name the answer, and only after the commitment', () => {
  it('are all case-insensitive, non-global regular expressions', () => {
    for (const id of DRILL_IDS) {
      const patterns = ecmoDrillSpec(id).precommitDenyPatterns
      expect(patterns.length).toBeGreaterThan(0)
      for (const pattern of patterns) {
        expect(pattern).toBeInstanceOf(RegExp)
        expect(`${id}: ${pattern.flags}`).toBe(`${id}: i`)
      }
    }
  })

  it('match the scenario diagnosis of every drill the grammar has a row for', () => {
    for (const id of Object.keys(ROW_BY_DRILL)) {
      const diagnosis = cardiohelpScenarioById.get(id)?.debrief.diagnosis ?? ''
      const matched = ecmoDrillSpec(id).precommitDenyPatterns.some((pattern) =>
        pattern.test(diagnosis),
      )
      expect(`${id}: ${matched}`).toBe(`${id}: true`)
    }
  })

  it('match what the console-tour drills actually teach, which no grammar row covers', () => {
    for (const id of ['startup-sensor-orientation', 'va-startup-sensor-orientation'] as const) {
      const scenario = cardiohelpScenarioById.get(id)
      if (!scenario) throw new Error(`No scenario ${id}`)
      const patterns = ecmoDrillSpec(id).precommitDenyPatterns
      const surfaces = [scenario.debrief.diagnosis, ...scenario.debrief.causalChain]
      expect(surfaces.some((text) => patterns.some((pattern) => pattern.test(text)))).toBe(true)
    }
  })

  it('never match the drill own prediction stem, the one pre-commit surface that exists', () => {
    for (const id of DRILL_IDS) {
      const stem = requireEcmoLearnPrediction(id).item.stem
      for (const pattern of ecmoDrillSpec(id).precommitDenyPatterns) {
        expect(`${id}: ${pattern.test(stem)}`).toBe(`${id}: false`)
      }
    }
  })
})

describe('the transfer principle carries a principle forward', () => {
  it('is exactly one sentence in every drill', () => {
    for (const id of DRILL_IDS) {
      const principle = ecmoDrillSpec(id).transferPrinciple
      expect(principle.trim().endsWith('.')).toBe(true)
      const sentences = principle.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0)
      expect(`${id}: ${sentences.length}`).toBe(`${id}: 1`)
    }
  })

  it('never names another drill fault', () => {
    for (const id of DRILL_IDS) {
      const principle = ecmoDrillSpec(id).transferPrinciple
      const scenario = cardiohelpScenarioById.get(id)
      const fault = `${scenario?.family}:${scenario?.expectation.correctiveFault}`
      for (const other of DRILL_IDS) {
        const otherScenario = cardiohelpScenarioById.get(other)
        const otherFault = `${otherScenario?.family}:${otherScenario?.expectation.correctiveFault}`
        if (otherFault === fault) continue
        for (const pattern of ecmoDrillSpec(other).precommitDenyPatterns) {
          expect(`${id} names ${other}: ${pattern.test(principle)}`).toBe(
            `${id} names ${other}: false`,
          )
        }
      }
    }
  })
})

describe('what a drill spec may say', () => {
  it('carries no number in any learner-facing string', () => {
    for (const id of DRILL_IDS) {
      for (const value of learnerFacingStrings(ecmoDrillSpec(id))) {
        expect(`${id}: ${value}`).not.toMatch(/\d/)
      }
    }
  })

  it('carries no reviewed learner-copy term', () => {
    for (const id of DRILL_IDS) {
      for (const value of learnerFacingStrings(ecmoDrillSpec(id))) {
        expect(`${id}: ${flaggedLearnerCopyTerms(value).join()}`).toBe(`${id}: `)
      }
    }
  })

  it('phrases nothing as a universal bedside target', () => {
    for (const id of DRILL_IDS) {
      for (const value of learnerFacingStrings(ecmoDrillSpec(id))) {
        assertNoUniversalTargetLanguage(value)
      }
    }
  })

  it('never teaches a resumption order in the air drills', () => {
    for (const id of ['arterial-bubble-stop', 'va-arterial-bubble-stop'] as const) {
      const strip = ecmoDrillSpec(id).controlPanel.sentence
      // Isolation is taught; where reset, restart and unclamping fall relative to one another is
      // deferred to the documents that govern it.
      expect(strip).toMatch(/isolate the patient/i)
      expect(strip).toMatch(/current IFU/i)
      expect(strip).not.toMatch(/reset(?:ting)? (?:is|comes|falls) (?:the )?last\b/i)
      expect(strip).not.toMatch(/open (?:the )?drainage(?: limb)?,? then (?:the )?return/i)
    }
  })

  it('cites only sources the scenario or the panel already established', () => {
    for (const id of DRILL_IDS) {
      const definition = ecmoDrillSpec(id)
      const scenario = cardiohelpScenarioById.get(id)
      expect(definition.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of definition.sourceIds) {
        expect(evidenceById.has(sourceId)).toBe(true)
        const established =
          (scenario?.evidenceIds ?? []).includes(sourceId) ||
          (ECMO_CONTROL_PANEL.sourceIds as readonly string[]).includes(sourceId)
        expect(`${id} cites ${sourceId}: ${established}`).toBe(`${id} cites ${sourceId}: true`)
      }
    }
  })
})

describe('the drill-spec validator catches what it claims to', () => {
  const mutate = (id: string, change: (definition: EcmoDrillSpec) => EcmoDrillSpec) => ({
    ...ecmoDrillSpecs,
    [id]: change(ecmoDrillSpec(id)),
  })

  it('rejects a strip state the scenario does not derive', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('preload-drainage-collapse', (definition) => ({
        ...definition,
        controlPanel: { ...definition.controlPanel, sweep: 'this-knob' },
      })),
    ).join('\n')
    expect(errors).toContain('preload-drainage-collapse')
    expect(errors).toContain('sweep is authored as this-knob but derives as not-this-knob')
  })

  it('rejects a direction the expectation does not name', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('acute-hypercapnia', (definition) => ({
        ...definition,
        controlPanel: { ...definition.controlPanel, direction: 'decrease' },
      })),
    ).join('\n')
    expect(errors).toContain('direction is authored as decrease but derives as increase')
  })

  it('rejects a grammar row from the wrong family', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('preload-drainage-collapse', (definition) => ({
        ...definition,
        localizationRowId: 'membrane-resistance',
      })),
    ).join('\n')
    expect(errors).toContain('belongs to oxygenator-resistance, not preload')
  })

  it('rejects a row on a drill whose family the grammar has none for', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('vv-recirculation', (definition) => ({
        ...definition,
        localizationRowId: 'drainage-limitation',
      })),
    ).join('\n')
    expect(errors).toContain('the grammar has no row for this family')
  })

  it('rejects a missing row on a drill whose family the grammar covers', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('gas-source-interruption', (definition) => ({
        ...definition,
        localizationRowId: undefined,
      })),
    ).join('\n')
    expect(errors).toContain('the grammar has a row for the gas-source-interruption family')
  })

  it('rejects a strip sentence whose clause disagrees with its state', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('preload-drainage-collapse', (definition) => ({
        ...definition,
        controlPanel: {
          ...definition.controlPanel,
          sentence: definition.controlPanel.sentence.replace('goes down', 'goes up'),
        },
      })),
    ).join('\n')
    expect(errors).toContain('does not say the knob goes decrease')
  })

  it('rejects a transfer principle that names another drill fault', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('preload-drainage-collapse', (definition) => ({
        ...definition,
        transferPrinciple:
          'A reassuring flow number can be recirculation rather than support reaching the patient.',
      })),
    ).join('\n')
    expect(errors).toContain('the transfer principle names the vv-recirculation fault')
  })

  it('rejects a deny pattern that would fire on the drill own stem', () => {
    const errors = validateEcmoDrillSpecs(
      mutate('preload-drainage-collapse', (definition) => ({
        ...definition,
        precommitDenyPatterns: [/chatter|juddering/i],
      })),
    ).join('\n')
    expect(errors).toContain("matches the drill's own prediction stem")
  })

  it('rejects a spec for a scenario that is not a drill', () => {
    const errors = validateEcmoDrillSpecs({
      ...ecmoDrillSpecs,
      'vv-off-sweep-capstone': {
        ...ecmoDrillSpec('preload-drainage-collapse'),
        scenarioId: 'vv-off-sweep-capstone',
      },
    }).join('\n')
    expect(errors).toContain('spec for something that is not a drill')
  })

  it('rejects a spec that goes missing', () => {
    const rest = { ...ecmoDrillSpecs }
    delete rest['transport-power-loss']
    expect(validateEcmoDrillSpecs(rest).join('\n')).toContain(
      'transport-power-loss: drill has no spec',
    )
  })
})
