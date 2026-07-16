import type {
  BagState,
  CrrtFlowRates,
  CrrtFlowTerm,
  ExternalFluidRates,
  FluidLedgerTotals,
} from './types'

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
  return value
}

function nonnegative(value: number, label: string): number {
  finite(value, label)
  if (value < 0) throw new RangeError(`${label} must be nonnegative.`)
  return value
}

function integrateMlPerHour(rateMlHour: number, durationSeconds: number): number {
  return finite(rateMlHour, 'Rate') * (nonnegative(durationSeconds, 'Duration') / 3600)
}

export const emptyExternalFluidRates: ExternalFluidRates = Object.freeze({
  maintenanceInputMlHour: 0,
  medicationCarrierInputMlHour: 0,
  nutritionInputMlHour: 0,
  bloodProductInputMlHour: 0,
  bolusInputMlHour: 0,
  otherInputMlHour: 0,
  urineOutputMlHour: 0,
  drainOutputMlHour: 0,
  otherOutputMlHour: 0,
})

export const emptyFluidLedgerTotals: FluidLedgerTotals = Object.freeze({
  maintenanceInputMl: 0,
  medicationCarrierInputMl: 0,
  nutritionInputMl: 0,
  bloodProductInputMl: 0,
  bolusInputMl: 0,
  otherInputMl: 0,
  urineOutputMl: 0,
  drainOutputMl: 0,
  otherOutputMl: 0,
  machinePatientFluidRemovalMl: 0,
  unintendedDeviceNetGainMl: 0,
})

export function totalExternalInputRateMlHour(rates: ExternalFluidRates): number {
  return (
    nonnegative(rates.maintenanceInputMlHour, 'Maintenance input rate') +
    nonnegative(rates.medicationCarrierInputMlHour, 'Medication-carrier input rate') +
    nonnegative(rates.nutritionInputMlHour, 'Nutrition input rate') +
    nonnegative(rates.bloodProductInputMlHour, 'Blood-product input rate') +
    nonnegative(rates.bolusInputMlHour, 'Bolus input rate') +
    nonnegative(rates.otherInputMlHour, 'Other input rate')
  )
}

export function totalExternalOutputRateMlHour(rates: ExternalFluidRates): number {
  return (
    nonnegative(rates.urineOutputMlHour, 'Urine output rate') +
    nonnegative(rates.drainOutputMlHour, 'Drain output rate') +
    nonnegative(rates.otherOutputMlHour, 'Other output rate')
  )
}

export function advanceFluidLedger(
  totals: FluidLedgerTotals,
  rates: ExternalFluidRates,
  actualMachinePatientFluidRemovalMlHour: number,
  unintendedDeviceNetGainMlHour: number,
  durationSeconds: number,
): FluidLedgerTotals {
  nonnegative(actualMachinePatientFluidRemovalMlHour, 'Actual machine PFR rate')
  finite(unintendedDeviceNetGainMlHour, 'Unintended device net-gain rate')
  nonnegative(durationSeconds, 'Duration')

  return {
    maintenanceInputMl:
      totals.maintenanceInputMl + integrateMlPerHour(rates.maintenanceInputMlHour, durationSeconds),
    medicationCarrierInputMl:
      totals.medicationCarrierInputMl +
      integrateMlPerHour(rates.medicationCarrierInputMlHour, durationSeconds),
    nutritionInputMl:
      totals.nutritionInputMl + integrateMlPerHour(rates.nutritionInputMlHour, durationSeconds),
    bloodProductInputMl:
      totals.bloodProductInputMl +
      integrateMlPerHour(rates.bloodProductInputMlHour, durationSeconds),
    bolusInputMl: totals.bolusInputMl + integrateMlPerHour(rates.bolusInputMlHour, durationSeconds),
    otherInputMl: totals.otherInputMl + integrateMlPerHour(rates.otherInputMlHour, durationSeconds),
    urineOutputMl:
      totals.urineOutputMl + integrateMlPerHour(rates.urineOutputMlHour, durationSeconds),
    drainOutputMl:
      totals.drainOutputMl + integrateMlPerHour(rates.drainOutputMlHour, durationSeconds),
    otherOutputMl:
      totals.otherOutputMl + integrateMlPerHour(rates.otherOutputMlHour, durationSeconds),
    machinePatientFluidRemovalMl:
      totals.machinePatientFluidRemovalMl +
      integrateMlPerHour(actualMachinePatientFluidRemovalMlHour, durationSeconds),
    unintendedDeviceNetGainMl:
      totals.unintendedDeviceNetGainMl +
      integrateMlPerHour(unintendedDeviceNetGainMlHour, durationSeconds),
  }
}

export function calculateWholePatientNetBalanceMl(totals: FluidLedgerTotals): number {
  const externalInputsMl =
    totals.maintenanceInputMl +
    totals.medicationCarrierInputMl +
    totals.nutritionInputMl +
    totals.bloodProductInputMl +
    totals.bolusInputMl +
    totals.otherInputMl
  const externalOutputsMl = totals.urineOutputMl + totals.drainOutputMl + totals.otherOutputMl
  return (
    externalInputsMl -
    externalOutputsMl -
    totals.machinePatientFluidRemovalMl +
    totals.unintendedDeviceNetGainMl
  )
}

function flowRateForTerm(
  term: CrrtFlowTerm,
  flows: CrrtFlowRates,
  effluentFlowMlHour: number,
): number {
  if (term === 'dialysate') return flows.dialysateFlowMlHour
  if (term === 'pbp') return flows.pbpFlowMlHour
  if (term === 'pre-replacement') return flows.preReplacementFlowMlHour
  if (term === 'post-replacement') return flows.postReplacementFlowMlHour
  if (term === 'syringe') return flows.syringeFlowMlHour
  if (term === 'makeup') return flows.makeupFlowMlHour
  return effluentFlowMlHour
}

function scaleFlowRates(flows: CrrtFlowRates, fraction: number): CrrtFlowRates {
  return {
    bloodFlowMlMin: flows.bloodFlowMlMin,
    dialysateFlowMlHour: flows.dialysateFlowMlHour * fraction,
    pbpFlowMlHour: flows.pbpFlowMlHour * fraction,
    preReplacementFlowMlHour: flows.preReplacementFlowMlHour * fraction,
    postReplacementFlowMlHour: flows.postReplacementFlowMlHour * fraction,
    patientFluidRemovalMlHour: flows.patientFluidRemovalMlHour * fraction,
    syringeFlowMlHour: flows.syringeFlowMlHour * fraction,
    makeupFlowMlHour: flows.makeupFlowMlHour * fraction,
  }
}

export interface CoupledBagDeliveryResult {
  readonly deliveryFraction: number
  readonly invalidTerms: readonly CrrtFlowTerm[]
}

/**
 * Computes one feasible fraction for every active source term and the effluent
 * collector. Phase 2 deliberately requires exactly one bag/collector per
 * active term so duplicate or missing topology fails closed instead of
 * creating or destroying fluid.
 */
export function calculateCoupledBagDeliveryFraction(
  bags: readonly BagState[],
  flows: CrrtFlowRates,
  effluentFlowMlHour: number,
  durationSeconds: number,
  pumpsRunning: boolean,
): CoupledBagDeliveryResult {
  nonnegative(effluentFlowMlHour, 'Effluent flow')
  nonnegative(durationSeconds, 'Duration')
  if (!pumpsRunning) return { deliveryFraction: 0, invalidTerms: [] }

  const terms: readonly CrrtFlowTerm[] = [
    'dialysate',
    'pbp',
    'pre-replacement',
    'post-replacement',
    'syringe',
    'makeup',
    'effluent',
  ]
  let deliveryFraction = 1
  const invalidTerms: CrrtFlowTerm[] = []

  for (const term of terms) {
    const rate = flowRateForTerm(term, flows, effluentFlowMlHour)
    if (rate === 0) continue
    const requestedVolumeMl = integrateMlPerHour(rate, durationSeconds)
    const matching = bags.filter((bag) => bag.flowTerm === term)
    const expectedDirection = term === 'effluent' ? 'effluent' : 'source'
    if (
      matching.length !== 1 ||
      matching[0].direction !== expectedDirection ||
      !matching[0].connected ||
      matching[0].scaleOpen
    ) {
      invalidTerms.push(term)
      deliveryFraction = 0
      continue
    }
    const bag = matching[0]
    const availableMl =
      bag.direction === 'source'
        ? bag.calculatedVolumeMl
        : Math.max(0, bag.capacityMl - bag.calculatedVolumeMl)
    const termFraction = requestedVolumeMl === 0 ? 1 : Math.min(1, availableMl / requestedVolumeMl)
    deliveryFraction = Math.min(deliveryFraction, termFraction)
  }

  return { deliveryFraction, invalidTerms }
}

export interface BagAdvanceResult {
  readonly bag: BagState
  readonly requestedPumpVolumeMl: number
  readonly actualPumpVolumeMl: number
  readonly limited: boolean
}

export function advanceBag(
  bag: BagState,
  requestedFlowMlHour: number,
  durationSeconds: number,
  pumpRunning: boolean,
): BagAdvanceResult {
  nonnegative(bag.capacityMl, 'Bag capacity')
  nonnegative(bag.calculatedVolumeMl, 'Calculated bag volume')
  nonnegative(bag.measuredVolumeMl, 'Measured bag volume')
  nonnegative(requestedFlowMlHour, 'Requested bag flow')
  nonnegative(durationSeconds, 'Duration')

  const requestedPumpVolumeMl = pumpRunning
    ? integrateMlPerHour(requestedFlowMlHour, durationSeconds)
    : 0
  const availableMl =
    bag.direction === 'source'
      ? bag.calculatedVolumeMl
      : Math.max(0, bag.capacityMl - bag.calculatedVolumeMl)
  const actualPumpVolumeMl =
    bag.connected && !bag.scaleOpen ? Math.min(requestedPumpVolumeMl, availableMl) : 0
  const direction = bag.direction === 'source' ? -1 : 1
  const calculatedVolumeMl = bag.calculatedVolumeMl + direction * actualPumpVolumeMl
  const measuredVolumeMl = Math.min(
    bag.capacityMl,
    Math.max(0, bag.measuredVolumeMl + direction * actualPumpVolumeMl),
  )

  return {
    bag: {
      ...bag,
      calculatedVolumeMl,
      measuredVolumeMl,
      cumulativePumpVolumeMl: bag.cumulativePumpVolumeMl + actualPumpVolumeMl,
    },
    requestedPumpVolumeMl,
    actualPumpVolumeMl,
    limited: actualPumpVolumeMl < requestedPumpVolumeMl,
  }
}

export function replaceBag(bag: BagState, replacementVolumeMl: number): BagState {
  nonnegative(replacementVolumeMl, 'Replacement bag volume')
  if (replacementVolumeMl > bag.capacityMl) {
    throw new RangeError('Replacement bag volume cannot exceed bag capacity.')
  }
  return {
    ...bag,
    calculatedVolumeMl: replacementVolumeMl,
    measuredVolumeMl: replacementVolumeMl,
    externalInterferenceMl: 0,
  }
}

export interface BagCollectionAdvanceResult {
  readonly bags: readonly BagState[]
  readonly actualPumpVolumeByTermMl: Readonly<Record<CrrtFlowTerm, number>>
  readonly limitedBagIds: readonly string[]
  readonly deliveryFraction: number
  readonly invalidTerms: readonly CrrtFlowTerm[]
}

export function advanceBagCollection(
  bags: readonly BagState[],
  flows: CrrtFlowRates,
  effluentFlowMlHour: number,
  durationSeconds: number,
  pumpsRunning: boolean,
): BagCollectionAdvanceResult {
  nonnegative(effluentFlowMlHour, 'Effluent flow')
  const coupled = calculateCoupledBagDeliveryFraction(
    bags,
    flows,
    effluentFlowMlHour,
    durationSeconds,
    pumpsRunning,
  )
  const actualFlows = scaleFlowRates(flows, coupled.deliveryFraction)
  const actualEffluentFlowMlHour = effluentFlowMlHour * coupled.deliveryFraction
  const actualPumpVolumeByTermMl: Record<CrrtFlowTerm, number> = {
    dialysate: 0,
    pbp: 0,
    'pre-replacement': 0,
    'post-replacement': 0,
    syringe: 0,
    makeup: 0,
    effluent: 0,
  }
  const limitedBagIds: string[] = []
  const nextBags = bags.map((bag) => {
    const result = advanceBag(
      bag,
      flowRateForTerm(bag.flowTerm, actualFlows, actualEffluentFlowMlHour),
      durationSeconds,
      pumpsRunning,
    )
    actualPumpVolumeByTermMl[bag.flowTerm] += result.actualPumpVolumeMl
    if (result.limited) limitedBagIds.push(bag.id)
    return result.bag
  })
  if (coupled.deliveryFraction < 1) {
    for (const bag of nextBags) {
      const atPhysicalLimit =
        (bag.direction === 'source' && bag.calculatedVolumeMl === 0) ||
        (bag.direction === 'effluent' && bag.calculatedVolumeMl === bag.capacityMl) ||
        !bag.connected ||
        bag.scaleOpen
      if (atPhysicalLimit && !limitedBagIds.includes(bag.id)) limitedBagIds.push(bag.id)
    }
  }

  return {
    bags: nextBags,
    actualPumpVolumeByTermMl,
    limitedBagIds,
    deliveryFraction: coupled.deliveryFraction,
    invalidTerms: coupled.invalidTerms,
  }
}
