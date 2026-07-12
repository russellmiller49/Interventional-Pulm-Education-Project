import {
  getInstrumentRoute,
  getInstrumentRouteForTool,
  instrumentRoutes,
  isInstrumentEntryPort,
  rigidPortIds,
  rigidPortTopology,
} from '../content/assemblyTopology'

describe('rigid bronchoscopy v2 topology', () => {
  it('defines four physically distinct EFER interfaces', () => {
    expect(rigidPortIds).toEqual(['mainAxial', 'accessory', 'anesthesiaCircuit', 'jet'])
    expect(rigidPortTopology.mainAxial.role).toBe('instrument')
    expect(rigidPortTopology.accessory.connection).toBe('accessory-gate')
    expect(rigidPortTopology.anesthesiaCircuit.connection).toBe('anesthesia-circuit')
    expect(rigidPortTopology.jet.connection).toBe('fixed-jet')
  })

  it('never assigns an instrument route to either ventilation port', () => {
    expect(instrumentRoutes).toHaveLength(5)
    expect(instrumentRoutes.every((route) => isInstrumentEntryPort(route.entryPort))).toBe(true)
    expect(instrumentRoutes.map((route) => route.entryPort)).not.toContain('anesthesiaCircuit')
    expect(instrumentRoutes.map((route) => route.entryPort)).not.toContain('jet')
  })

  it('selects the correct route and interface for each supported tool configuration', () => {
    expect(getInstrumentRoute('optical-forceps-main-axial')).toMatchObject({
      selectedToolId: 'tool-optical-grasping-forceps',
      entryPort: 'mainAxial',
      requiredInterface: 'bs2319-optical-forceps-cap',
    })
    expect(getInstrumentRouteForTool('tool-suction-catheter-3mm')).toMatchObject({
      id: 'suction-main-axial',
      entryPort: 'mainAxial',
      requiredInterface: 'bs2311-telescope-instrument-cap',
    })
    expect(getInstrumentRouteForTool('tool-semi-rigid-grasping-forceps')).toMatchObject({
      id: 'semi-rigid-grasping-accessory',
      entryPort: 'accessory',
      requiredInterface: 'bb2402-double-gate',
    })
    expect(getInstrumentRoute('stent-introducer-main-axial')).toMatchObject({
      selectedToolId: 'tool-stent-introducer',
      insertedDiametersMm: [7.5],
      requiredInterface: 'open-main-axial',
      dimensionsEstimated: true,
    })
  })
})
