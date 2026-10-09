import type { ReactNode } from 'react'

import {
  ECMO_AIR_FIRST_MOVES,
  ECMO_AIR_RESUME,
  ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES,
  ECMO_NUMBERS,
  type EcmoNumberId,
} from '../../content/teachingNumbers'

/** The name printed in each short citation, keyed by the register's source id. */
const ECMO_NUMBER_SOURCE_NAMES: Readonly<Record<string, string>> = {
  'ifu-us-2025-scope': 'CARDIOHELP-i Instructions for Use',
  'ifu-console-workflow': 'CARDIOHELP-i Instructions for Use',
  'ecmo-book-ch18': 'The ECMO Book',
  'TEXT-HEI-ELS-2023': 'Hei, Extracorporeal Life Support',
  'TEXT-SCHMIDT-ECMO-ADULTS-2022': 'Schmidt, ECMO for Adults',
  'TEXT-TAHA-ECMO-PRACTICAL-2024': 'Taha, ECMO: A Practical Guide',
}

function citation(sources: readonly { readonly sourceId: string; readonly year: number }[]) {
  return [
    ...new Set(
      sources.map(
        (source) =>
          `${ECMO_NUMBER_SOURCE_NAMES[source.sourceId] ?? source.sourceId} ${source.year}`,
      ),
    ),
  ].join('; ')
}

const BOX_CLASS = 'mt-3 min-w-0 rounded-xl border px-3 py-2 text-xs leading-5'

/** Said once per box. It follows the numbers; it never replaces one. */
export const ECMO_TYPICAL_VALUES_LINE = 'Typical values; your program may vary.'

/**
 * The numbers a fellow holds a console reading or an order against, each with its source.
 *
 * Every figure comes from the numbers register; where two sources differ, the row's note says
 * which gives which.
 */
export function EcmoReferenceValues({
  title,
  ids,
  children,
}: {
  readonly title: string
  readonly ids: readonly EcmoNumberId[]
  readonly children?: ReactNode
}) {
  return (
    <section className={BOX_CLASS} data-reference-values>
      <h4 className="text-xs font-semibold">{title}</h4>
      <dl className="mt-1 grid gap-1">
        {ids.map((id) => {
          const row = ECMO_NUMBERS.get(id)
          return (
            <div key={id} data-teaching-number={id}>
              <dt className="inline font-medium">{`${row.label}: `}</dt>
              <dd className="inline">
                <strong>{row.value}</strong>
                {`${row.note ? `. ${row.note}` : ''} `}
                <small>{`(${citation(row.sources)})`}</small>
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="mt-1">{ECMO_TYPICAL_VALUES_LINE}</p>
      {children}
    </section>
  )
}

/** Console factory limits beside the textbook operating ranges for the same channels. */
export function EcmoCircuitPressureReference() {
  return (
    <EcmoReferenceValues
      title="Circuit pressures: factory limits and usual ranges"
      ids={[
        'pven-factory-limits',
        'negative-pressure-caution',
        'pump-inlet-pressure-typical',
        'pint-part-factory-limits',
        'pre-oxygenator-pressure-typical',
        'post-oxygenator-pressure-typical',
        'pressure-drop-factory-limit',
        'pressure-drop-typical',
      ]}
    />
  )
}

/** Flow, sweep and the first blood gas when support starts. */
export function EcmoStartingSupportReference() {
  return (
    <EcmoReferenceValues
      title="Starting support"
      ids={[
        'full-support-flow',
        'sweep-start',
        'sweep-recheck',
        'flow-factory-limit',
        'speed-factory-limit',
      ]}
    />
  )
}

/** Heparin at cannulation and the three ways its effect is followed. */
export function EcmoAnticoagulationReference() {
  return (
    <EcmoReferenceValues
      title="Anticoagulation with unfractionated heparin"
      ids={['heparin-bolus', 'act-target', 'anti-xa-target', 'aptt-target']}
    />
  )
}

/** Venous-cell alarm limits the console ships with. */
export function EcmoVenousCellReference() {
  return (
    <EcmoReferenceValues
      title="Venous measuring cell: factory limits"
      ids={['svo2-factory-limit', 'hb-factory-limits']}
    />
  )
}

function OrderedMoves({ moves }: { readonly moves: readonly string[] }) {
  return (
    <ol className="mt-1 list-decimal pl-5">
      {moves.map((move) => (
        <li key={move}>{move}</li>
      ))}
    </ol>
  )
}

/** Air in the circuit: the first moves in order, then what must be true before support resumes. */
export function EcmoAirFirstMoves({ supportMode }: { readonly supportMode: 'vv' | 'va' }) {
  const moves =
    supportMode === 'va' ? ECMO_AIR_FIRST_MOVES.massiveVa : ECMO_AIR_FIRST_MOVES.massiveVv
  return (
    <section className={BOX_CLASS} data-first-moves="air">
      <h4 className="text-xs font-semibold">
        {supportMode === 'va'
          ? 'Massive air on VA: first moves, in order'
          : 'Massive air on VV: first moves, in order'}
      </h4>
      <OrderedMoves moves={moves} />
      <p className="mt-1">
        <small>{`(${citation([ECMO_AIR_FIRST_MOVES.source])}; ${ECMO_AIR_FIRST_MOVES.source.locator}. Air enters the circuit in ${ECMO_NUMBERS.value('air-entrainment-rate')}.)`}</small>
      </p>
      <h4 className="mt-2 text-xs font-semibold">Resuming on the CARDIOHELP</h4>
      <OrderedMoves moves={ECMO_AIR_RESUME.conditions} />
      <p className="mt-1">
        <small>{`(${citation(ECMO_AIR_RESUME.sources)}; ${ECMO_AIR_RESUME.sources.map((source) => source.locator).join('; ')})`}</small>
      </p>
    </section>
  )
}

/** Differential hypoxemia on peripheral VA: how it is found, then the moves in order. */
export function EcmoDifferentialHypoxemiaMoves() {
  return (
    <section className={BOX_CLASS} data-first-moves="differential-hypoxemia">
      <h4 className="text-xs font-semibold">
        Differential hypoxemia: recognize, then act in order
      </h4>
      <p className="mt-1">{ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.recognize}</p>
      <OrderedMoves moves={ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.moves} />
      <p className="mt-1">
        <small>{`(${citation([ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.source])}; ${ECMO_DIFFERENTIAL_HYPOXEMIA_MOVES.source.locator})`}</small>
      </p>
    </section>
  )
}

/** Flow and pulsatility on peripheral VA support. */
export function EcmoVaSupportReference() {
  return (
    <EcmoReferenceValues
      title="VA support: usual values"
      ids={['va-flow-goal', 'lv-vent-pulsatility', 'sweep-start', 'sweep-recheck']}
    />
  )
}

/** Where sweep starts and how fast carbon dioxide is brought down. */
export function EcmoSweepReference() {
  return (
    <EcmoReferenceValues
      title="Sweep: usual values"
      ids={['sweep-start', 'sweep-recheck', 'paco2-correction-time']}
    />
  )
}
