import type { DolphinSourceId } from '../data/sources'

/**
 * The lidocaine ledger exercise: one maximum per kilogram for every route added together, and each
 * planned or given volume counted against it. Values come from the register (`lidocaine-max`,
 * `lidocaine-split`); the weight is the case's own.
 */
export interface LedgerPlannedLine {
  readonly id: string
  readonly label: string
  readonly volumeMl: number
  readonly percent: number
}

export interface LidocaineLedgerSpec {
  readonly id: string
  /** The case: the animal and its weight. */
  readonly situation: string
  readonly weightKg: number
  readonly mgPerKg: number
  /** Volumes already planned, counted before the learner plans the rest. */
  readonly planned: readonly LedgerPlannedLine[]
  /** The concentration the remaining lidocaine will be given in. */
  readonly remainingPercent: number
  readonly remainingLabel: string
  readonly numberIds: readonly string[]
  readonly sourceIds: readonly DolphinSourceId[]
}

export const DOLPHIN_LEDGERS: readonly LidocaineLedgerSpec[] = [
  {
    id: 'workshop-181',
    situation:
      'An adult bottlenose dolphin weighing 181 kg is booked for bronchoscopy. You plan topical lidocaine by atomizer, catheter, jelly and syringes into the bronchi.',
    weightKg: 181,
    mgPerKg: 4,
    planned: [
      {
        id: 'atomizer',
        label: 'Atomizer into the blowhole and nasal passage',
        volumeMl: 10,
        percent: 1,
      },
      { id: 'catheter', label: 'Injected for catheter placement', volumeMl: 5, percent: 1 },
    ],
    remainingPercent: 2,
    remainingLabel: 'Jelly and the syringes into the bronchi, as 2%',
    numberIds: ['lidocaine-max', 'lidocaine-split'],
    sourceIds: ['nmmp-workshop-2024'],
  },
]

export const dolphinLedgerById: ReadonlyMap<string, LidocaineLedgerSpec> = new Map(
  DOLPHIN_LEDGERS.map((ledger) => [ledger.id, ledger] as const),
)
