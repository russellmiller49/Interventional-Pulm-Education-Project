import { NUMBER_REGISTER } from '../content/numbers'
import { bronchSection } from '../content/pathway'
import { section } from '../content/sections/ventilated-patient'
import { bronchStageLesson } from '../content/stageLessons'

function block(id: string) {
  const found = section.blocks.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No block ${id}`)
  return found
}
const words = (id: string) => {
  const found = block(id)
  return [found.body, ...(found.points ?? []), ...(found.steps ?? [])].join(' ')
}
const scenario = () => {
  if (section.act.kind !== 'scenario') throw new Error('Expected the scenario')
  return section.act.scenario
}

/**
 * The owner's ruling of 2026-11-13 (`bf-s15-ventilated`), point by point. The numbers in brackets
 * are the points of his note.
 */
describe('the ventilated patient, after the owner ruling of 2026-11-13', () => {
  it('prepares the ventilator with the therapist and says what to watch [1]', () => {
    const settings = block('settings-before')
    expect(settings.heading).toBe('Prepare the ventilator with the therapist')
    expect(settings.body).toMatch(
      /delivered volume, peak and plateau pressure, saturation, blood pressure/,
    )
    expect(settings.body).toMatch(/The scope will raise resistance in the tube/)
    expect(words('settings-before')).toMatch(/Volume alarms: set near baseline/)
  })

  it('never teaches the tidal volume rise as a routine step, and keeps the sourced number [2]', () => {
    const tidalVolume = block('raising-tidal-volume')
    expect(tidalVolume.heading).toBe('Before you change the tidal volume')
    expect(tidalVolume.body).toContain('{{num:vent-tidal-volume-increase}}')
    expect(tidalVolume.body).toMatch(/One bronchoscopy guideline allows/)
    expect(tidalVolume.body).toMatch(/one option, not a routine step/)

    const weigh = (tidalVolume.points ?? []).join(' ')
    expect(weigh).toMatch(/Lung-protective limits still apply/)
    expect(weigh).toMatch(/predicted body weight/)
    expect(weigh).toMatch(/plateau/)
    expect(weigh).toMatch(/breath out does not finish/)
    expect(weigh).toMatch(/Accepting a smaller delivered breath for a few minutes may be safer/)
    expect(weigh).toMatch(/Taking the scope out restores the breath/)

    // The settings list leaves the tidal volume alone.
    const settings = (block('settings-before').points ?? []).join(' ')
    expect(settings).toMatch(/Tidal volume: leave it/)
    expect(settings).not.toMatch(/may be raised by|raise it by/)

    // The register row is unchanged and unsigned.
    const row = NUMBER_REGISTER['vent-tidal-volume-increase']
    expect(row.value).toBe('100–150 mL')
    expect(row.label).toMatch(/may be raised/)
  })

  it('shows the number on its own screen, after the ventilator and trapped gas are read', () => {
    const titles = bronchStageLesson('ventilated-patient').steps.map((step) => step.title)
    expect(titles.indexOf('Trapped gas')).toBe(titles.indexOf('Read the ventilator') + 1)
    expect(titles.indexOf('Before you change the tidal volume')).toBe(
      titles.indexOf('Trapped gas') + 1,
    )
    expect(titles).not.toContain('Raising the tidal volume')

    const resolved = bronchSection('ventilated-patient').blocks.find(
      (candidate) => candidate.id === 'raising-tidal-volume',
    )
    expect(resolved?.body).toContain('100–150 mL')
    expect(resolved?.body).not.toContain('{{num:')
  })

  it('says how each mode answers resistance, and guarantees neither [3]', () => {
    const reading = (block('peak-and-plateau').points ?? []).join(' ')
    expect(reading).toMatch(/Volume-targeted: pressure rises to deliver the set volume/)
    expect(reading).toMatch(/A leak, suction or the pressure limit can still cost delivered volume/)
    expect(reading).toMatch(/Pressure-targeted: the pressure holds and the delivered volume falls/)
    expect(reading).not.toMatch(/pushes each breath past the scope/)
  })

  it('reads plateau pressure as the respiratory system, not the lung alone [4]', () => {
    const reading = block('peak-and-plateau')
    expect(reading.body).toMatch(/recoil of the respiratory system: lung and chest wall/)
    expect(words('peak-and-plateau')).not.toMatch(/lung alone/)
    expect(words('peak-and-plateau')).toMatch(
      /Peak up, plateau unchanged: resistance from the scope/,
    )
    expect(words('peak-and-plateau')).toMatch(/Plateau up: the respiratory system has changed/)
    const practice = section.practice.find((entry) => entry.id === 'mc-both-pressures-rise')!
    expect(practice.item.explanation).toMatch(
      /Peak and plateau together are the respiratory system/,
    )
  })

  it('keeps PEEP unless there is a reason to change it [5]', () => {
    const settings = (block('settings-before').points ?? []).join(' ')
    expect(settings).toMatch(/PEEP: keep what the lung needs/)
    expect(settings).toMatch(/Revisit it for trapped gas, not for the scope/)
    expect(settings).not.toMatch(/Decide whether to lower it/)
  })

  it('teaches auto-PEEP by recognition, relief and time to breathe out [6]', () => {
    const trapped = words('auto-peep')
    expect(trapped).toMatch(/dynamic hyperinflation/)
    expect(trapped).toMatch(
      /Plateau rises or delivered volume falls, and the blood pressure can drop/,
    )
    expect(trapped).toMatch(/flow has not reached zero when the next breath starts/)
    expect(trapped).toMatch(
      /Reduce the obstruction: clear secretions, and take the scope out if needed/,
    )
    expect(trapped).toMatch(/a slower rate or shorter breath in/)
  })

  it('opens the circuit only as a qualified emergency measure, with no duration [7]', () => {
    const trapped = words('auto-peep')
    expect(trapped).toMatch(/Opening the circuit is an emergency measure/)
    expect(trapped).toMatch(/severe trapped gas with a collapsing blood pressure/)
    expect(trapped).toMatch(/never routine/)
    const everything = section.blocks.map((entry) => words(entry.id)).join(' ')
    expect(everything).not.toMatch(/a moment off the circuit/)
    expect(everything).not.toMatch(/\b(one|1)[- ]minute\b|\bfor \d+ (seconds|minutes?)\b/i)
  })

  it('keeps the sealed circuit through the swivel adapter [8]', () => {
    expect(words('swivel-adapter')).toMatch(/sealed port/)
    expect(words('swivel-adapter')).toMatch(/Never open the circuit to pass the scope/)
  })

  it('does not recruit by routine afterwards [9]', () => {
    const after = words('suction-and-recruitment')
    expect(after).toMatch(/reassess with the therapist/)
    expect(after).toMatch(/Recruitment is not routine/)
    expect(after).toMatch(/only when the lung has lost volume/)
    expect(after).not.toMatch(/then recruit with the therapist/)
    expect(after).not.toMatch(/\bcmH₂O\b|\bseconds\b/)

    const frame = scenario().frames.find((candidate) => candidate.id === 'afterwards')!
    const key = frame.choices.find((choice) => choice.plausibility === 'best')!
    expect(key.label).toBe('Reassess, step the settings back, then decide on recruitment')
    expect(key.rationale).toMatch(/not from routine/)
    expect(frame.choices.map((choice) => choice.label).join(' ')).not.toMatch(/^Recruit the lung/)
  })

  it('keeps the scope coming out early, and separates the causes on the card [10]', () => {
    const card = block('ventilation-falls')
    expect(card.steps?.[0]).toBe('Take the scope out of the tube.')
    const steps = (card.steps ?? []).join(' ')
    expect(steps).toMatch(/delivered volume, peak, plateau, and whether the breath out finishes/)
    expect(steps).toMatch(/Trapped gas with a low blood pressure: give a longer breath out/)
    expect(steps).toMatch(
      /Plateau up, or no recovery: check the tube, listen to both sides, and look for a pneumothorax/,
    )

    const frame = scenario().frames.find((candidate) => candidate.id === 'volume-falls')!
    const key = frame.choices.find((choice) => choice.plausibility === 'best')!
    expect(key.label).toBe('Take the scope out and give him time to breathe out')
    const raised = frame.choices.find((choice) => /tidal volume raised/.test(choice.label))
    expect(raised?.plausibility).toBe('incorrect-mechanism')
    expect(raised?.rationale).toMatch(/breath out has not finished/)
    expect(raised?.consequence?.situation).toMatch(/auto-PEEP climbs/)
  })

  it('separates the high-pressure alarm from the low-volume alarms in pressure control', () => {
    const reading = (block('peak-and-plateau').points ?? []).join(' ')
    expect(reading).not.toMatch(/no alarm/i)
    expect(reading).toMatch(/high-pressure alarm does not warn you/)
    expect(reading).toMatch(/Low-volume and low minute-ventilation alarms can/)

    const { situation, choices, explanation } = section.transfer
    expect(situation).toMatch(/high-pressure alarm is silent/)
    expect(situation).toMatch(/low-volume alarm, set well below her baseline/)
    expect(choices.map((choice) => choice.rationale).join(' ')).not.toMatch(/no alarm/i)
    expect(explanation).toMatch(/low-volume or low minute-ventilation alarm sounds only/)
    // The keyed plan no longer answers a lost volume with a higher set pressure.
    const key = choices.find((choice) => choice.plausibility === 'best')!
    expect(key.label).not.toMatch(/higher set pressure/)
  })

  it('leaves every ventilator number unsigned', () => {
    for (const id of ['vent-fio2', 'vent-fio2-lead-time', 'vent-tidal-volume-increase'] as const)
      expect(NUMBER_REGISTER[id].signedBy ?? null).toBeNull()
  })
})
