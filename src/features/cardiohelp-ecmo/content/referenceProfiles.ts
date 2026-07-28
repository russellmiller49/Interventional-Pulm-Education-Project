import type {
  EcmoPhysiologyModelInputs,
  GasState,
  PatientState,
  SupportMode,
} from '../engine/types'

/**
 * Stable reference circuits for the didactic Learn sections.
 *
 * These are deliberately **not** scenarios. A physiology section needs a live circuit to read, but
 * it does not need a scored drill: there are no faults, no timed faults, no objectives, no
 * prediction, no debrief. The orientation scenarios cannot serve this purpose — they open with the
 * pump stopped, RPM at zero, a self-test pending and a startup-inspection fault active, so a
 * "normal state" lesson would sit beside a console that is visibly not supporting anyone.
 *
 * **Only inputs are authored here.** Blood flow and the three circuit pressures are derived by the
 * engine and then checked against `expected` in `npm run dump:ecmo-signals`, so this file cannot
 * drift from the physics by asserting a number the model does not produce.
 *
 * The two profiles hold pump and gas settings identical on purpose. Everything that differs
 * between them then has to come from series versus parallel physiology rather than from an
 * arbitrary change of RPM — which is the point of putting VV and VA side by side at all.
 *
 * Evidence boundary: bounded-educational-model. These are teaching anchors, not clinical targets,
 * and normality here is a stable relationship and trajectory rather than a set of bedside numbers.
 */
export type EcmoReferenceProfileId = 'vv-reference' | 'va-reference'

/** Where a Learn section gets the live state it renders against. */
export type EcmoLearnStateSource =
  | { readonly kind: 'reference-profile'; readonly profileId: EcmoReferenceProfileId }
  | { readonly kind: 'scenario'; readonly scenarioId: string }

export interface EcmoExpectedRange {
  readonly low: number
  readonly high: number
}

export interface EcmoReferenceProfile {
  readonly id: EcmoReferenceProfileId
  readonly supportMode: SupportMode
  readonly title: string
  readonly summary: string
  /** Authored inputs. Flow and pressures are never authored — they are derived from these. */
  readonly inputs: {
    readonly rpmSetpoint: number
    readonly gas: Pick<GasState, 'sweepLpm' | 'fio2'>
    readonly patient: Partial<PatientState>
    /** Authored explicitly rather than inherited, so the oxygen balance is visible at the profile. */
    readonly modelInputs: EcmoPhysiologyModelInputs
  }
  /** Bounds the derived state must satisfy. Enforced by the dump harness and by tests. */
  readonly expected: {
    readonly bloodFlow: EcmoExpectedRange
    readonly pVen: EcmoExpectedRange
    readonly pArt: EcmoExpectedRange
    readonly pInt: EcmoExpectedRange
    readonly deltaP: EcmoExpectedRange
    readonly recirculationFraction: number
    readonly recirculationAdjustedCircuitFlowLpm?: EcmoExpectedRange
    readonly pulsePressure?: EcmoExpectedRange
    readonly rightRadialSpo2?: EcmoExpectedRange
    readonly femoralArterialSpo2?: EcmoExpectedRange
  }
}

const sharedCircuitExpectation = {
  bloodFlow: { low: 4.0, high: 4.1 },
  pVen: { low: -38, high: -32 },
  pArt: { low: 208, high: 214 },
  pInt: { low: 240, high: 246 },
  deltaP: { low: 29, high: 34 },
} as const

export const ecmoReferenceProfiles: Readonly<Record<EcmoReferenceProfileId, EcmoReferenceProfile>> =
  Object.freeze({
    'vv-reference': {
      id: 'vv-reference',
      supportMode: 'vv',
      title: 'Stable VV reference circuit',
      summary:
        'A VV circuit running without any injected problem. Drainage and return are both venous, so circuit blood is in series with the native lung and some of what is returned is drained straight back.',
      inputs: {
        rpmSetpoint: 3200,
        gas: { sweepLpm: 4, fio2: 1 },
        patient: { nativeCardiacOutputLpm: 4.5 },
        modelInputs: { oxygenConsumptionMlMin: 150 },
      },
      expected: {
        ...sharedCircuitExpectation,
        recirculationFraction: 0.08,
        recirculationAdjustedCircuitFlowLpm: { low: 3.6, high: 3.8 },
      },
    },
    'va-reference': {
      id: 'va-reference',
      supportMode: 'va',
      title: 'Stable VA reference circuit',
      summary:
        'A VA circuit at the same pump and gas settings as the VV reference. Return is arterial, so circuit flow runs in parallel with the native heart and competes with it rather than being drained back.',
      inputs: {
        rpmSetpoint: 3200,
        gas: { sweepLpm: 4, fio2: 1 },
        patient: { nativeCardiacOutputLpm: 2.4 },
        modelInputs: { oxygenConsumptionMlMin: 150 },
      },
      expected: {
        ...sharedCircuitExpectation,
        // Arterial return is not in series with drainage, so the VV recirculation term does not apply.
        recirculationFraction: 0,
        pulsePressure: { low: 14, high: 22 },
        rightRadialSpo2: { low: 94, high: 98 },
        femoralArterialSpo2: { low: 97, high: 99.5 },
      },
    },
  })

export const ecmoReferenceProfileList: readonly EcmoReferenceProfile[] = Object.freeze(
  Object.values(ecmoReferenceProfiles),
)

export function isEcmoReferenceProfileId(value: string): value is EcmoReferenceProfileId {
  return value in ecmoReferenceProfiles
}

export function ecmoReferenceProfileForMode(mode: SupportMode): EcmoReferenceProfile {
  return mode === 'va'
    ? ecmoReferenceProfiles['va-reference']
    : ecmoReferenceProfiles['vv-reference']
}
