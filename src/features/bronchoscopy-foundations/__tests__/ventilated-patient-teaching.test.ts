import { NUMBER_REGISTER } from '../content/numbers'
import { bronchSection } from '../content/pathway'
import { section } from '../content/sections/ventilated-patient'
import { bronchStageLesson } from '../content/stageLessons'

function block(id: string) {
  const found = section.blocks.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`No block ${id}`)
  return found
}

describe('the ventilated patient: tidal volume and alarms', () => {
  it('teaches the tidal volume rise as conditional, and keeps the sourced number', () => {
    const tidalVolume = block('raising-tidal-volume')
    expect(tidalVolume.body).toContain('{{num:vent-tidal-volume-increase}}')
    expect(tidalVolume.body).toMatch(/exhaled volume is below baseline/)
    expect(tidalVolume.body).toMatch(/plateau has not moved/)
    expect(tidalVolume.body).toMatch(/may win it back/)

    const settings = block('settings-before').points ?? []
    expect(settings.join(' ')).toMatch(/Tidal volume: may be raised by/)
    expect(settings.join(' ')).not.toMatch(/raise it by/)

    const row = NUMBER_REGISTER['vent-tidal-volume-increase']
    expect(row.value).toBe('100–150 mL')
    expect(row.label).toMatch(/may be raised/)
  })

  it('gives the tidal volume its own screen, after the ventilator is read, with the number shown', () => {
    const titles = bronchStageLesson('ventilated-patient').steps.map((step) => step.title)
    expect(titles.indexOf('Raising the tidal volume')).toBe(
      titles.indexOf('Read the ventilator') + 1,
    )

    const resolved = bronchSection('ventilated-patient').blocks.find(
      (candidate) => candidate.id === 'raising-tidal-volume',
    )
    expect(resolved?.body).toContain('100–150 mL')
    expect(resolved?.body).not.toContain('{{num:')
  })

  it('names when not to raise the tidal volume, on the page and in the case', () => {
    const limits = (block('raising-tidal-volume').points ?? []).join(' ')
    expect(limits).toMatch(/lung-protective/)
    expect(limits).toMatch(/breath out does not finish/)
    expect(limits).toMatch(/carbon dioxide/)

    if (section.act.kind !== 'scenario') throw new Error('Expected the scenario')
    const frame = section.act.scenario.frames.find((candidate) => candidate.id === 'volume-falls')
    const raised = frame?.choices.find((choice) => /tidal volume raised/.test(choice.label))
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
  })
})
