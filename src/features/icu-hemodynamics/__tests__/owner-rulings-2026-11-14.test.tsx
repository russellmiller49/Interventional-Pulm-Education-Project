/**
 * The owner's rulings of 2026-11-14 on ICU Hemodynamics that this file holds in place:
 * `hd-363-unsourced-lines` (overwedging told apart from pulmonary-artery injury; wedge duration as
 * the manufacturer's upper limit) and `hd-05-hypotension-no-vasopressor`. Nothing here signs a row.
 */
import { render, screen } from '@testing-library/react'

import { HemodynamicsReferenceValues } from '../components/HemodynamicsReferenceValues'
import { hemodynamicCaseById } from '../content'
import { hemodynamicTeachingArtifacts } from '../content/hemodynamicTeaching'
import { pacPrebriefStopConditions } from '../content/pacAdvancementPrebrief'
import { pawpCaptureSteps } from '../content/pawpCaptureSequence'
import { hemodynamicsSectionSpecs } from '../content/sectionSpecs'
import { HEMODYNAMICS_NUMBERS } from '../content/teachingNumbers'
import { artifactDefinitions } from '../content/troubleshootingAtlas'
import {
  advanceHemodynamicSimulation,
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
} from '../engine'

// Only what a learner is shown: the troubleshooting card, the prebrief's stop conditions, wedge step 7.
const overwedging = artifactDefinitions.overwedging.actions.join(' ')
const stop = pacPrebriefStopConditions.find(
  (condition) => condition.id === 'do-not-flush',
)!.response
const deflate = pawpCaptureSteps.find((step) => step.id === 'deflate')!.whatYouDo
const shown = [overwedging, stop, deflate].join(' ')
const LIMIT = 'two respiratory cycles, or 10 to 15 seconds'

describe('wedge duration (hd-363-unsourced-lines, point 2)', () => {
  it('holds the limit as a device row cited to the Edwards instructions, unsigned', () => {
    const row = HEMODYNAMICS_NUMBERS.rows.find((entry) => entry.id === 'wedge-inflation-limit')!
    expect(row.value).toBe(LIMIT)
    expect(row.class).toBe('device')
    expect(row.sources.map((source) => source.sourceId)).toEqual(['edwards-swan-ganz-ifu-2023'])
    expect(row.sources[0].locator).toMatch(/§12\.3 .*§14\.1 /)
    expect(row.note).toMatch(/An upper limit, not a time to aim for/)
    expect(row.signedBy).toBeNull()
  })

  it('teaches it in the wedge step as the named manufacturer’s upper limit, never as a target', () => {
    expect(deflate).toMatch(/just long enough to read the value at end expiration/)
    expect(deflate).toContain(`The Edwards Swan-Ganz instructions limit inflation to ${LIMIT}`)
    expect(deflate).toMatch(/the instructions for the catheter in use apply/)
    expect(deflate).toMatch(/That is an upper limit: deflate sooner once you have the value/)
    expect(shown).not.toMatch(
      /(hold( it)? for|aim for|inflate for) (two respiratory cycles|10 to 15)/,
    )
  })

  it('shows the row, with its source named, in the balloon reference box', () => {
    render(
      <HemodynamicsReferenceValues
        title="The balloon, in numbers"
        ids={['wedge-inflation-limit']}
      />,
    )
    expect(screen.getByText(LIMIT, { exact: false })).toBeVisible()
    expect(screen.getByText(/Edwards Swan-Ganz instructions for use/)).toBeVisible()
  })

  it('says the simulator’s own release is not the bedside limit', () => {
    expect(JSON.stringify(hemodynamicsSectionSpecs)).toMatch(
      /That timing is the simulator’s; at the bedside the limit is the one in the catheter’s instructions/,
    )
  })
})

describe('overwedging and hemoptysis are different problems (hd-363-unsourced-lines, point 1)', () => {
  it('overwedging without bleeding: stop, passive deflation, no flush, confirm the artery tracing', () => {
    expect(overwedging).toMatch(
      /Stop inflation immediately and allow passive balloon deflation\. Do not flush\./,
    )
    expect(overwedging).toMatch(/Confirm that the pulmonary-artery waveform returns\./)
  })

  it('new hemoptysis: stop manipulating, protect the airway, position, and call three kinds of help', () => {
    for (const words of [overwedging, stop]) {
      expect(words).toMatch(/[Nn]ew hemoptysis/)
      expect(words).toMatch(/[Ss]top manipulating the catheter/)
      expect(words).toMatch(/secure and protect the airway/)
      expect(words).toMatch(
        /position the patient with the suspected bleeding lung down when appropriate/,
      )
      expect(words).toMatch(/critical care, interventional and surgical help at once/)
    }
  })

  it('does not teach “balloon down” as the rule for established bleeding, or reinflation in a distal artery', () => {
    expect(shown).not.toMatch(/balloon down, affected side down/)
    expect(shown).not.toMatch(/[Ff]or hemoptysis: deflate/)
    expect(shown).not.toMatch(/hemoptysis[^.]*(deflate|balloon down)/i)
    expect(overwedging).toMatch(/is a specialist decision/)
    expect(overwedging).toMatch(
      /Balloon occlusion or tamponade proximal to the injury is sometimes used by the specialist team/,
    )
    expect(overwedging).toMatch(/do not reinflate a balloon in a distal, possibly injured artery/)
    expect(stop).toMatch(/do not reinflate it in a distal, possibly injured artery/)
  })
})

describe('HD-05 (hd-05-hypotension-no-vasopressor)', () => {
  const definition = hemodynamicCaseById.get('HD-05')!
  const after = (ids: readonly string[]) => {
    let state = createInitialHemodynamicState(definition, 'practice', 900)
    state = icuHemodynamicsReducer(state, { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 })
    state = icuHemodynamicsReducer(state, { type: 'ZERO_TRANSDUCER' })
    for (const id of ids)
      state = icuHemodynamicsReducer(state, {
        type: 'APPLY_INTERVENTION',
        intervention: definition.interventions.find((candidate) => candidate.id === id)!,
      })
    return advanceHemodynamicSimulation(state, 300).measurements
  }

  it('states the hypotension in the stem, and the stem agrees with the monitor', () => {
    expect(definition.presentation).toMatch(
      /is hypotensive, with a mean arterial pressure near 50 mmHg/,
    )
    const opening = after([]).mapMmHg!
    expect(opening).toBeGreaterThanOrEqual(45)
    expect(opening).toBeLessThanOrEqual(55)
  })

  it('offers a vasopressor, which raises the mean pressure and does not stand in for RV support', () => {
    expect(definition.interventions.map((entry) => entry.id)).toContain('norepinephrine-up')
    expect(definition.requiredInterventionIds).not.toContain('norepinephrine-up')
    const alone = after(['norepinephrine-up'])
    expect(alone.mapMmHg! - after([]).mapMmHg!).toBeGreaterThanOrEqual(10)
    // The pressure comes up; the output does not. The case is not resolved by a vasopressor alone.
    expect(alone.cardiacIndexLMinM2!).toBeLessThan(2.2)
  })

  it('names the hypotension where the worked reasoning lists the findings', () => {
    expect(JSON.stringify(hemodynamicTeachingArtifacts)).toMatch(
      /Hypotension, high PAP and RAP, low output, and PAWP at or below the pre-capillary boundary/,
    )
  })

  it('with the keyed treatment as well, reaches the endpoint with a mean pressure of 65 or more', () => {
    const keyed = after(definition.requiredInterventionIds)
    expect(keyed.cardiacIndexLMinM2!).toBeGreaterThanOrEqual(2.2)
    const supported = after([...definition.requiredInterventionIds, 'norepinephrine-up'])
    expect(supported.cardiacIndexLMinM2!).toBeGreaterThanOrEqual(2.2)
    expect(supported.mapMmHg!).toBeGreaterThanOrEqual(65)
    // Not approval of it: on the keyed path alone the mean stays low today (r2-pr553-hd06, item 6).
    // If this fails, the case or the engine changed and the PR's trace table is out of date.
    expect(keyed.mapMmHg!).toBeLessThan(65)
  })
})
