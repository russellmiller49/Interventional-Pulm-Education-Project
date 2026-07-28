import { publicIcuScenarioManifest } from '../content/publicScenarioManifest'
import { icuScenarios } from '../content/scenarios'

describe('public ICU scenario manifest boundary', () => {
  it('matches the safe compatibility fields in every private scenario definition', () => {
    expect(publicIcuScenarioManifest).toEqual(
      icuScenarios.map(({ id, version }) => ({ id, version })),
    )
  })

  it('contains only approved non-clinical compatibility metadata', () => {
    for (const entry of publicIcuScenarioManifest) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'version'])
      expect(JSON.stringify(entry)).not.toMatch(
        /patient|answer|score|action|command|device|setting|waveform|replay/i,
      )
    }
  })
})
