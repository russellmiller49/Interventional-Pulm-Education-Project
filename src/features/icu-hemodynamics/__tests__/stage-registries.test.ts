import {
  HEMODYNAMICS_CONTROL_PANEL,
  validateHemodynamicsControlPanel,
} from '../content/controlPanel'
import { routeStops, validateRouteSpine } from '../content/routeSpine'
import { hemodynamicsSectionSpecs, validateHemodynamicsSectionSpecs } from '../content/sectionSpecs'
import { signalGrammarRows, validateSignalGrammar } from '../content/signalGrammar'

describe('the stage registries validate at import', () => {
  it('route spine', () => {
    expect(validateRouteSpine()).toEqual([])
    expect(routeStops).toHaveLength(5)
  })
  it('control panel', () => {
    expect(validateHemodynamicsControlPanel()).toEqual([])
    expect(HEMODYNAMICS_CONTROL_PANEL.controls).toHaveLength(5)
  })
  it('signal grammar', () => {
    expect(validateSignalGrammar()).toEqual([])
    expect(signalGrammarRows.length).toBeGreaterThanOrEqual(10)
  })
  it('section specs', () => {
    expect(validateHemodynamicsSectionSpecs()).toEqual([])
    expect(hemodynamicsSectionSpecs).toHaveLength(9)
  })
})
