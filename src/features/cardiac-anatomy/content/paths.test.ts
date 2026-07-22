import * as THREE from 'three'

import {
  CARDIAC_RIG,
  CT_CARDIAC_PROVENANCE,
  ECMO_CANNULATION_ROUTES,
  IMPELLA_ADVANCEMENT_PROGRESS,
  IMPELLA_ADVANCEMENT_ROUTE,
  IMPELLA_CP_MODEL_URL,
  IMPELLA_55_ADVANCEMENT_PROGRESS,
  IMPELLA_55_ADVANCEMENT_ROUTE,
  IMPELLA_55_MODEL_URL,
  IMPELLA_RP_ADVANCEMENT_PROGRESS,
  IMPELLA_RP_ADVANCEMENT_ROUTE,
  IMPELLA_RP_MODEL_URL,
  IMPELLA_DEVICE_REGISTRATION,
  PAC_POSITION_ANATOMY,
  PAC_ROUTE,
  PAC_ROUTE_ENDPOINT_INDEX,
  REALISTIC_HEART_MODEL_URL,
  pacRouteForPosition,
  type PacAnatomyPosition,
} from './paths'

function runtimeCurveLengthMm(
  points: readonly (readonly [number, number, number])[],
  startProgress: number,
  endProgress: number,
): number {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
  )
  const samples = 512
  let previous = curve.getPointAt(startProgress)
  let lengthWebUnits = 0
  for (let index = 1; index <= samples; index += 1) {
    const progress = startProgress + ((endProgress - startProgress) * index) / samples
    const current = curve.getPointAt(progress)
    lengthWebUnits += previous.distanceTo(current)
    previous = current
  }
  return lengthWebUnits / CT_CARDIAC_PROVENANCE.webUnitsPerMm
}

describe('shared cardiac anatomy landmarks', () => {
  it('uses cache-safe versioned URLs for the CT heart and procedural Impella assets', () => {
    expect(REALISTIC_HEART_MODEL_URL).toBe('/models/cardiac/heart-ct-animated-v1.glb')
    expect(IMPELLA_CP_MODEL_URL).toBe('/models/cardiac-devices/impella-cp-v1.glb')
    expect(IMPELLA_55_MODEL_URL).toBe('/models/cardiac-devices/impella-55-v1.glb')
    expect(IMPELLA_RP_MODEL_URL).toBe('/models/cardiac-devices/impella-rp-v1.glb')
    expect(CARDIAC_RIG.impella.deviceRegistration.modelUrl).toBe(IMPELLA_CP_MODEL_URL)
    expect(CARDIAC_RIG.impella55.deviceRegistration.modelUrl).toBe(IMPELLA_55_MODEL_URL)
    expect(CARDIAC_RIG.impellaRp.deviceRegistration.modelUrl).toBe(IMPELLA_RP_MODEL_URL)
  })

  it('reveals the PAC route progressively and wedges without intentional distal advancement', () => {
    const sequence: readonly PacAnatomyPosition[] = ['introducer', 'ra', 'rv', 'pa', 'wedge']
    const lengths = sequence.map((position) => pacRouteForPosition(position).length)

    expect(lengths).toEqual([...lengths].sort((left, right) => left - right))
    expect(new Set(lengths).size).toBe(sequence.length - 1)
    expect(pacRouteForPosition('wedge')).toEqual(pacRouteForPosition('pa'))
  })

  it.each(Object.keys(PAC_ROUTE_ENDPOINT_INDEX) as PacAnatomyPosition[])(
    'keeps the %s endpoint and text landmark defined together',
    (position) => {
      const route = pacRouteForPosition(position)
      expect(route.at(-1)).toBe(PAC_ROUTE[PAC_ROUTE_ENDPOINT_INDEX[position]])
      expect(PAC_POSITION_ANATOMY[position].landmark).toBeTruthy()
      expect(PAC_POSITION_ANATOMY[position].waveform).toBeTruthy()
    },
  )

  it('keeps the IABP balloon below the left-subclavian origin and above the renal arteries', () => {
    const centerY = CARDIAC_RIG.iabp.balloonCenter[1]
    const cranialEndY = centerY + 1.16
    const caudalEndY = centerY - 1.16
    const leftSubclavianOriginY = CARDIAC_RIG.iabpAorta.archBranches[2][0][1]
    const renalOriginY = CARDIAC_RIG.iabpAorta.renalBranches[0][0][1]

    expect(cranialEndY).toBeLessThan(leftSubclavianOriginY)
    expect(caudalEndY).toBeGreaterThan(renalOriginY)
  })

  it('retains the distal patient-right PA branch for provenance without using it as a wedge target', () => {
    const distalBranch = PAC_ROUTE.at(-1)!
    expect(distalBranch[0]).toBeLessThan(-1.5)
    expect(distalBranch).toEqual([-1.5335, 0.41642, -0.22862])
    expect(pacRouteForPosition('wedge').at(-1)).not.toEqual(distalBranch)
  })

  it('defines Impella malposition as ordered positions on one anatomic spline', () => {
    expect(IMPELLA_ADVANCEMENT_PROGRESS.tooShallow).toBeLessThan(
      IMPELLA_ADVANCEMENT_PROGRESS.correct,
    )
    expect(IMPELLA_ADVANCEMENT_PROGRESS.correct).toBeLessThan(IMPELLA_ADVANCEMENT_PROGRESS.deep)
    const correctDepthMm =
      ((IMPELLA_ADVANCEMENT_PROGRESS.correct - IMPELLA_ADVANCEMENT_PROGRESS.aorticValve) *
        CARDIAC_RIG.impella.advancement.lengthWebUnits) /
      CT_CARDIAC_PROVENANCE.webUnitsPerMm
    expect(correctDepthMm).toBeGreaterThanOrEqual(32)
    expect(correctDepthMm).toBeLessThanOrEqual(38)
    expect(IMPELLA_DEVICE_REGISTRATION.inletLocal).toEqual([0, 0, 0])
    expect(IMPELLA_DEVICE_REGISTRATION.outletLocal).toEqual([0, -1.128, 0])
  })

  it('keeps the Impella route retrograde through the CT aorta before entering the LV', () => {
    const first = IMPELLA_ADVANCEMENT_ROUTE[0]
    const aorticRootIndex = Math.round(
      IMPELLA_ADVANCEMENT_PROGRESS.aorticRoot * (IMPELLA_ADVANCEMENT_ROUTE.length - 1),
    )
    const aorticRoot = IMPELLA_ADVANCEMENT_ROUTE[aorticRootIndex]
    const last = IMPELLA_ADVANCEMENT_ROUTE.at(-1)!

    expect(first[1]).toBeLessThan(-2)
    expect(aorticRoot[1]).toBeGreaterThan(0.2)
    expect(last[1]).toBeLessThan(-0.55)
    expect(last[2]).toBeGreaterThan(0.25)
  })

  it('keeps the 5.5 axillary boundary distinct before joining the CT aorta and segmented valve', () => {
    expect(IMPELLA_55_ADVANCEMENT_PROGRESS.access).toBeLessThan(
      IMPELLA_55_ADVANCEMENT_PROGRESS.aorticRoot,
    )
    expect(IMPELLA_55_ADVANCEMENT_PROGRESS.aorticRoot).toBeLessThan(
      IMPELLA_55_ADVANCEMENT_PROGRESS.aorticValve,
    )
    expect(IMPELLA_55_ADVANCEMENT_PROGRESS.aorticValve).toBeLessThan(
      IMPELLA_55_ADVANCEMENT_PROGRESS.correct,
    )
    expect(IMPELLA_55_ADVANCEMENT_PROGRESS.correct).toBeLessThan(
      IMPELLA_55_ADVANCEMENT_PROGRESS.deep,
    )
    const inletDepthMm =
      ((IMPELLA_55_ADVANCEMENT_PROGRESS.correct - IMPELLA_55_ADVANCEMENT_PROGRESS.aorticValve) *
        CARDIAC_RIG.impella55.advancement.lengthWebUnits) /
      CT_CARDIAC_PROVENANCE.webUnitsPerMm
    expect(inletDepthMm).toBeGreaterThanOrEqual(46)
    expect(inletDepthMm).toBeLessThanOrEqual(54)
    expect(IMPELLA_55_ADVANCEMENT_ROUTE[0][0]).toBeLessThan(-1)
    expect(CT_CARDIAC_PROVENANCE.authoredImpella55Access).toMatch(/no axillary/i)
  })

  it('orders the RP route from femoral/IVC access through proxy gates to a PA outlet', () => {
    const progress = IMPELLA_RP_ADVANCEMENT_PROGRESS
    expect(progress.access).toBeLessThan(progress.ivcInlet)
    expect(progress.ivcInlet).toBeLessThan(progress.tricuspidGate)
    expect(progress.tricuspidGate).toBeLessThan(progress.rv)
    expect(progress.rv).toBeLessThan(progress.pulmonicGate)
    expect(progress.pulmonicGate).toBeLessThan(progress.tooProximal)
    expect(progress.tooProximal).toBeLessThan(progress.correct)
    expect(progress.correct).toBeLessThan(progress.tooDistal)
    expect(IMPELLA_RP_ADVANCEMENT_ROUTE.length).toBeGreaterThan(100)
    expect(CT_CARDIAC_PROVENANCE.impellaRpValveGates).toMatch(/route\/orifice gates only/i)
    const inletToOutletArcMm = runtimeCurveLengthMm(
      IMPELLA_RP_ADVANCEMENT_ROUTE,
      progress.ivcInlet,
      progress.correct,
    )
    const tooProximalArcMm = runtimeCurveLengthMm(
      IMPELLA_RP_ADVANCEMENT_ROUTE,
      progress.ivcInlet,
      progress.tooProximal,
    )
    expect(inletToOutletArcMm).toBeGreaterThanOrEqual(204.9)
    expect(inletToOutletArcMm).toBeLessThanOrEqual(205.1)
    expect(tooProximalArcMm).toBeGreaterThanOrEqual(189.9)
    expect(tooProximalArcMm).toBeLessThanOrEqual(190.1)
    expect(CT_CARDIAC_PROVENANCE.impellaRpOutletRegistration).toMatchObject({
      inletSource: 'endpoint of Inferior Vena Cava (0).mrk.json',
      inletSourceControlPointIndex: 0,
      inletProgress: progress.ivcInlet,
      tooProximalInletToOutletArcMm: 190,
      correctInletToOutletArcMm: 205,
      correctOutletSource: 'Pulmonary Artery (0).mrk.json',
      correctOutletControlPointBracket: [26, 27],
      rawSource205MmReference: {
        controlPointBracket: [16, 17],
      },
    })
  })

  it('records the non-centerline LV bridge instead of claiming full CT centerline coverage', () => {
    expect(CT_CARDIAC_PROVENANCE.sourceCoordinateSystem).toBe('LPS')
    expect(CT_CARDIAC_PROVENANCE.authoredBridge).toMatch(/no LV centerline/i)
    expect(CT_CARDIAC_PROVENANCE.valveMorphology).toMatch(/cusp segmentations/i)
    expect(CT_CARDIAC_PROVENANCE.valveMorphology).toMatch(
      /Mitral, tricuspid, and pulmonic.*location proxies/i,
    )
  })

  it('keeps VV and peripheral VA ECMO returns on distinct venous and arterial routes', () => {
    const vvReturn = ECMO_CANNULATION_ROUTES.vv.jugularVenousReturn.points
    const vaReturn = ECMO_CANNULATION_ROUTES.va.femoralArterialReturn.points
    expect(vvReturn.at(-1)).not.toEqual(vaReturn.at(-1))
    expect(vvReturn[0][1]).toBeGreaterThan(1.9)
    expect(vaReturn[0][1]).toBeLessThan(-2)
    expect(CT_CARDIAC_PROVENANCE.authoredPeripheralExtension).toMatch(/no iliac or femoral/i)
  })
})
