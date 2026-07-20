import {
  CARDIAC_RIG,
  PAC_POSITION_ANATOMY,
  PAC_ROUTE,
  PAC_ROUTE_ENDPOINT_INDEX,
  pacRouteForPosition,
  type PacAnatomyPosition,
} from './paths'

describe('shared cardiac anatomy landmarks', () => {
  it('reveals the PAC route progressively from introducer through wedge', () => {
    const sequence: readonly PacAnatomyPosition[] = ['introducer', 'ra', 'rv', 'pa', 'wedge']
    const lengths = sequence.map((position) => pacRouteForPosition(position).length)

    expect(lengths).toEqual([...lengths].sort((left, right) => left - right))
    expect(new Set(lengths).size).toBe(sequence.length)
    expect(pacRouteForPosition('wedge')).toEqual(PAC_ROUTE)
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

  it('terminates the wedge route inside the extended right pulmonary-artery branch', () => {
    const wedge = PAC_ROUTE.at(-1)!
    const rightPaEnd = CARDIAC_RIG.heartVessels.pulmonaryArteries[1].at(-1)!
    const distance = Math.hypot(
      wedge[0] - rightPaEnd[0],
      wedge[1] - rightPaEnd[1],
      wedge[2] - rightPaEnd[2],
    )
    expect(distance).toBeLessThan(0.2)
  })

  it('defines Impella malposition as three-axis anatomical offsets', () => {
    expect(CARDIAC_RIG.impella.positionOffsets['too-deep'][0]).not.toBe(0)
    expect(CARDIAC_RIG.impella.positionOffsets['too-deep'][2]).not.toBe(0)
    expect(CARDIAC_RIG.impella.positionOffsets['too-shallow'][0]).not.toBe(0)
  })

  it('keeps the flexible Impella shaft on the distal aortic centerline', () => {
    const first = CARDIAC_RIG.impella.shaftRoute[0]
    const last = CARDIAC_RIG.impella.shaftRoute.at(-1)!
    const distalAorta = CARDIAC_RIG.heartVessels.aorta.at(-1)!

    expect(first[1]).toBeGreaterThan(0.5)
    expect(first[1] - last[1]).toBeGreaterThan(2)
    expect(Math.hypot(last[0] - distalAorta[0], last[1] - distalAorta[1])).toBeLessThan(0.2)
  })
})
