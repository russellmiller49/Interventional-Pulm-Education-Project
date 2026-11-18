/**
 * The owner's MCS register ruling of 2026-11-12 (`mcs-register-signoff`), held in place: 14 rows
 * signed because their citations were re-verified, five rows corrected and returned unsigned, and
 * the LVAD resuscitation teaching requirements.
 */
import { render } from '@testing-library/react'

import { ReferenceValues } from '../components/teaching/shared'
import { LVAD_HIGH_AFTERLOAD_MAP_MMHG } from '../engine/model'
import { MCS_GLOSSARY_ABBREVIATIONS } from '../content/glossaryAbbreviations'
import { MCS_LVAD_PERFUSION, MCS_LVAD_PERFUSION_DECISIONS } from '../content/lvadPerfusionCase'
import { mcsSectionLearningContracts } from '../content/sectionLearningContracts'
import { mcsSupportPathwayCards } from '../content/supportPathways'
import { MCS_NUMBERS } from '../content/teachingNumbers'
import { mcsReplay } from '../test-support/replayHarness'

const row = (id: string) => MCS_NUMBERS.rows.find((entry) => entry.id === id)!
const contracts = JSON.stringify(mcsSectionLearningContracts)

const SIGNED = [
  // All seven Impella device rows.
  'impella-cp-flow-by-level',
  'impella-cp-peak-flow',
  'impella-55-flow-by-level',
  'impella-cp-inlet-depth',
  'impella-cp-inlet-too-deep',
  'impella-55-inlet-depth',
  'impella-reposition-p-level',
  // Both HeartMate 3 speed rows.
  'heartmate3-speed-typical',
  'heartmate3-speed-range',
  // All five LVAD resuscitation rows.
  'lvad-adequate-capillary-refill',
  'lvad-adequate-map',
  'lvad-adequate-etco2',
  'lvad-adequate-controller-flow',
  'lvad-cpr-deferral-limit',
] as const

/** Corrected on his ruling and returned for his review: not signed. */
const CORRECTED_UNSIGNED = [
  'lvad-map-goal',
  'lvad-map-ceiling',
  'lvad-power-elevation',
  'lvad-hemolysis-markers',
  'lvad-pulsatility-index',
] as const

describe('the 14 rows signed under the ruling of 2026-11-12', () => {
  it('are exactly the rows he named, and no other', () => {
    const signed = MCS_NUMBERS.rows.filter(({ signedBy }) => signedBy !== null).map(({ id }) => id)
    expect([...signed].sort()).toEqual([...SIGNED].sort())
    expect(MCS_NUMBERS.rows).toHaveLength(SIGNED.length + CORRECTED_UNSIGNED.length)
  })

  it('say who signed, how and when, and that each was re-read on 2026-11-18', () => {
    for (const id of SIGNED) {
      expect({ id, signedBy: row(id).signedBy, signedOn: row(id).signedOn }).toEqual({
        id,
        signedBy: 'Russell Miller, written decision of 2026-11-12 (sources checked by Claude)',
        signedOn: '2026-11-12',
      })
      expect({ id, checkedOn: row(id).checkedOn }).toEqual({ id, checkedOn: '2026-11-18' })
      expect(row(id).sources.length).toBeGreaterThan(0)
    }
  })

  it('keep the device model in each Impella row and the manual revision in its source', () => {
    for (const id of SIGNED.filter((entry) => entry.startsWith('impella-'))) {
      expect(row(id).label).toMatch(/Impella (CP|5\.5)|Performance level/)
      for (const { sourceId } of row(id).sources) {
        expect(sourceId).toMatch(/^impella-(cp-ifu-rev-v|55-ifu-rev-l)-supplied$/)
      }
      expect(row(id).checkedBy).toMatch(/0048-9007 rV.*10003049 rL/)
    }
  })

  it('label the HeartMate 3 speeds as typical operating speed against the manufacturer’s range', () => {
    expect(row('heartmate3-speed-typical').label).toBe('HeartMate 3 typical operating speed')
    expect(row('heartmate3-speed-range').label).toBe(
      'HeartMate 3 speed: the manufacturer’s adjustable range',
    )
    expect(row('heartmate3-speed-range').sources.map(({ sourceId }) => sourceId)).toContain(
      'abbott-heartmate3-pump-parameters-card',
    )
    const cards = JSON.stringify(mcsSupportPathwayCards)
    expect(cards).toMatch(
      /HeartMate 3 typical operating speed: 5,000–6,000 rpm[^.]*\. The manufacturer’s adjustable range is 3,000–9,000 rpm/,
    )
  })

  it('keep the separate British/ERC and AHA values in the resuscitation rows', () => {
    expect(row('lvad-adequate-map').value).toBe(
      'above 60 mm Hg (British, ERC) · above 50 mm Hg (AHA)',
    )
    expect(row('lvad-adequate-etco2').value).toBe(
      'above 2 kPa (15 mm Hg), intubated (British, ERC) · above 20 mm Hg (AHA)',
    )
    expect(row('lvad-adequate-capillary-refill').value).toBe('under 3 seconds')
    expect(row('lvad-adequate-controller-flow').value).toBe('typically above 3 L/min in an adult')
  })
})

describe('the five rows corrected and returned unsigned', () => {
  it('are not signed', () => {
    for (const id of CORRECTED_UNSIGNED) {
      expect({ id, signedBy: row(id).signedBy, signedOn: row(id).signedOn }).toEqual({
        id,
        signedBy: null,
        signedOn: null,
      })
      expect(row(id).note).toMatch(/Returned unsigned for his review/)
    }
  })

  it('lvad-map-goal: 75–90 mm Hg from ISHLT 2023, a treatment goal, with 70–80 kept as the narrower textbook target', () => {
    const goal = row('lvad-map-goal')
    expect(goal.value).toBe('75–90 mm Hg')
    expect(goal.sources[0]).toMatchObject({
      sourceId: 'ishlt-durable-mcs-2023',
      year: 2023,
      grade: 'Class IIa, Level B',
    })
    // The on-point recommendation (p. e141), and only sources that print the value.
    expect(goal.sources).toHaveLength(1)
    expect(goal.sources[0]?.locator).toMatch(/p\. e141/)
    expect(goal.note).toMatch(/70–80 mm Hg before, which is one textbook chapter’s narrower target/)
    expect(goal.appliesTo).toMatch(/Not the line for an adequate circulation in an emergency/)
    expect(contracts).toMatch(/mean arterial pressure is in the goal range of 75–90 mm Hg/)
    expect(contracts).not.toMatch(/70–80 mm Hg/)
  })

  it('needs no engine change: the reference patient sits inside the goal and the alarm fires above 90', () => {
    const reference = mcsReplay({ id: 'reference-map', device: 'lvad' }, [{ id: 'arm' }]).arms.arm
    expect(reference.metrics.mapMmHg).toBe(76)
    expect(reference.activeAlarmIds).toHaveLength(0)
    expect(LVAD_HIGH_AFTERLOAD_MAP_MMHG).toBe(90)
  })

  it('lvad-map-ceiling: a sustained mean above 90 is generally avoided, not an absolute rule', () => {
    const ceiling = row('lvad-map-ceiling')
    expect(ceiling.value).toBe('sustained above 90 mm Hg')
    expect(ceiling.appliesTo).toMatch(/Not a requirement that every reading be under 90 mm Hg/)
    expect(contracts).toMatch(/a mean pressure sustained above 90 mm Hg is generally avoided/)
    expect(contracts).not.toMatch(/the mean pressure is kept below 90/)
  })

  it('lvad-power-elevation: the thresholds stay, as warning signs read against the baseline', () => {
    const power = row('lvad-power-elevation')
    expect(power.value).toBe('10 W or more, or more than 2 W above baseline for over 24 hours')
    expect(power.label).toBe('Power changes that raise suspicion of pump thrombosis')
    expect(power.appliesTo).toMatch(/Warning signs, not diagnostic criteria/)
    expect(contracts).toMatch(
      /They are warning signs: read them for this pump against this patient’s baseline, with the clinical picture, the hemolysis markers and the pump’s log, never alone/,
    )
    expect(contracts).not.toMatch(/Power elevation that suggests pump thrombosis/)
  })

  it('lvad-hemolysis-markers: an LDH trend against a pump-specific baseline, with free hemoglobin kept as a marker', () => {
    const markers = row('lvad-hemolysis-markers')
    expect(markers.value).toMatch(/an LDH rising above the usual baseline for that pump/)
    expect(markers.value).toMatch(/about 2\.5 times the upper limit of normal/)
    expect(markers.value).toMatch(/plasma free hemoglobin above 40 mg\/dL/)
    expect(markers.appliesTo).toMatch(/Neither is required for the diagnosis/)
    expect(markers.sources[0]?.sourceId).toBe('ishlt-durable-mcs-2023')
  })

  it('lvad-pulsatility-index: no flow formula times ten as the HeartMate 3 calculation', () => {
    const index = row('lvad-pulsatility-index')
    expect(index.value).not.toMatch(/× 10/)
    expect(index.value).toMatch(/averaged over 15-second intervals; observed clinical range 1–10/)
    expect(index.sources[0]?.sourceId).toBe('abbott-heartmate3-pump-parameters-card')
    const glossary = JSON.stringify(MCS_GLOSSARY_ABBREVIATIONS)
    expect(glossary).not.toMatch(/× 10/)
    expect(glossary).toMatch(/not as a flow measurement/)
  })
})

describe('source attribution on screen', () => {
  it('prints a source name, never a raw source id, for the corrected rows', () => {
    const view = render(
      <ReferenceValues
        title="check"
        ids={[
          'lvad-map-goal',
          'lvad-map-ceiling',
          'lvad-power-elevation',
          'lvad-pulsatility-index',
        ]}
        grades
      />,
    )
    const text = view.container.textContent ?? ''
    expect(text).not.toMatch(/ishlt-durable-mcs-2023|abbott-heartmate3-pump-parameters-card/)
    expect(text).toMatch(/75–90 mm Hg \(ISHLT guidelines 2023, Class IIa, Level B\)/)
    expect(text).toMatch(/Abbott HeartMate 3 parameter card 2025/)
  })

  it('cites for each corrected value only sources that print it', () => {
    // The textbook chapters print 70–80 and 60–80, and the old pulsatility formula.
    expect(row('lvad-map-goal').sources.map(({ sourceId }) => sourceId)).toEqual([
      'ishlt-durable-mcs-2023',
    ])
    expect(row('lvad-pulsatility-index').sources.map(({ sourceId }) => sourceId)).toEqual([
      'abbott-heartmate3-pump-parameters-card',
    ])
    // ISHLT gives no power threshold.
    expect(row('lvad-power-elevation').sources.map(({ sourceId }) => sourceId)).not.toContain(
      'ishlt-durable-mcs-2023',
    )
  })
})

describe('LVAD resuscitation teaching requirements', () => {
  const arrest = MCS_LVAD_PERFUSION_DECISIONS.find(({ kind }) => kind === 'arrest')!.item

  it('tells the emergency lines apart from the treatment goal, on the screen', () => {
    expect(MCS_LVAD_PERFUSION.combining).toMatch(
      /lines for an adequate circulation in an emergency, not the pressure to treat toward: the goal on a continuous-flow LVAD is a mean of 75–90 mm Hg/,
    )
  })

  it('teaches the values as parts of a clinical assessment', () => {
    expect(MCS_LVAD_PERFUSION.combining).toMatch(
      /one abnormal value does not define arrest: read it with mentation, skin and the other signs/,
    )
  })

  it('with two rescuers, keys compressions at once alongside the device work', () => {
    expect(arrest.correctChoiceIds).toEqual(['compress-device-alongside'])
    expect(MCS_LVAD_PERFUSION.sequence[1]).toMatch(
      /^With two or more of you, start compressions at once and work the device at the same time/,
    )
  })

  it('keeps the British two-minute device-first period in its context, and never as the key', () => {
    const deviceFirst = arrest.choices.find(({ id }) => id === 'device-first-two-minutes')!
    expect(deviceFirst.plausibility).not.toBe('best')
    expect(MCS_LVAD_PERFUSION.sequence[1]).toMatch(
      /The British guideline allows CPR to wait at most 2 minutes while the pump is restored, and ERC 2025 keeps that delay for a rescuer working alone/,
    )
    expect(row('lvad-cpr-deferral-limit').value).toMatch(
      /at most 2 minutes \(British; ERC, a lone rescuer\)/,
    )
  })
})
