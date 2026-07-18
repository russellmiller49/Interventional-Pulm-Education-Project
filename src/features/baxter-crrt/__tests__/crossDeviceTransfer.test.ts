import {
  baxterCrrtCrossDeviceTransferCapstone,
  scoreBaxterCrrtCrossDeviceTransfer,
  type CrrtCrossDeviceTransferDomainId,
} from '../content/crossDeviceTransfer'

describe('cross-device workflow translation capstone', () => {
  it('is an operational five-domain capstone without an interchangeability claim', () => {
    expect(baxterCrrtCrossDeviceTransferCapstone).toMatchObject({
      id: 'TRANSFER-PRISMAX-PRISMAFLEX-01',
      status: 'operational-v1',
      deviceIds: ['prismax-aw8035-2xx', 'prismaflex-g5036003-6xx'],
      minimumScore: 80,
      canonicalOutcomeTolerance: 1e-9,
      clinicalInterchangeabilityClaimed: false,
    })
    expect(baxterCrrtCrossDeviceTransferCapstone.domains.map((domain) => domain.id)).toEqual([
      'setup-navigation',
      'prescription-display',
      'pressure-localization',
      'fluid-accounting',
      'alarm-stop-end',
    ])
    expect(
      baxterCrrtCrossDeviceTransferCapstone.domains.every(
        (domain) =>
          domain.prismaxExpression.length > 0 &&
          domain.prismaflexExpression.length > 0 &&
          domain.sourceRecordIds.length > 0,
      ),
    ).toBe(true)
  })

  it('scores complete answers at the declared threshold and rejects incomplete attempts', () => {
    const correct = Object.fromEntries(
      baxterCrrtCrossDeviceTransferCapstone.domains.map((domain) => [
        domain.id,
        domain.correctOptionId,
      ]),
    ) as Record<CrrtCrossDeviceTransferDomainId, string>

    expect(scoreBaxterCrrtCrossDeviceTransfer(correct)).toEqual({
      score: 100,
      passed: true,
      completed: true,
    })

    const oneWrong = { ...correct, 'setup-navigation': 'setup-identical' }
    expect(scoreBaxterCrrtCrossDeviceTransfer(oneWrong)).toEqual({
      score: 80,
      passed: true,
      completed: true,
    })
    expect(scoreBaxterCrrtCrossDeviceTransfer({})).toEqual({
      score: 0,
      passed: false,
      completed: false,
    })
  })

  it('deep-freezes authored definitions', () => {
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferCapstone)).toBe(true)
    expect(Object.isFrozen(baxterCrrtCrossDeviceTransferCapstone.domains)).toBe(true)
    expect(baxterCrrtCrossDeviceTransferCapstone.domains.every(Object.isFrozen)).toBe(true)
    expect(
      baxterCrrtCrossDeviceTransferCapstone.domains.every(
        (domain) => Object.isFrozen(domain.options) && Object.isFrozen(domain.sourceRecordIds),
      ),
    ).toBe(true)
  })
})
