import type { McsSimulationState } from '../../engine/types'
import type { McsPresentationKind } from '../../content/taskPresentation'
import { reading } from '../teaching/selectors'
import styles from './mcs-flow.module.css'

export function McsTaskReadings({
  state,
  kind,
  withholdFlow = false,
}: {
  state: McsSimulationState
  kind: McsPresentationKind
  withholdFlow?: boolean
}) {
  const m = state.metrics
  const fields: [string, number | null | undefined, string, string][] = [
    ['Mean arterial pressure', m.mapMmHg, 'mm Hg', 'Modeled pressure'],
    ['Right atrial pressure', m.rapMmHg, 'mm Hg', 'Modeled filling pressure'],
    ['Wedge pressure', m.pcwpMmHg, 'mm Hg', 'Modeled filling pressure'],
    ...(!withholdFlow
      ? ([
          ['Concurrent native flow', m.nativeFlowLMin, 'L/min', 'Modeled forward flow'],
          ...(state.device.kind === 'iabp'
            ? []
            : [
                ['Left pump estimate', m.leftDeviceFlowLMin, 'L/min', 'Simulated device estimate'],
                ...(state.device.kind === 'impella' && state.device.right.enabled
                  ? [
                      [
                        'RP pump estimate',
                        m.rightDeviceFlowLMin,
                        'L/min',
                        'Serial pulmonary route; do not add to systemic flow',
                      ],
                    ]
                  : []),
              ]),
          [
            'Effective systemic flow',
            m.effectiveSystemicFlowLMin,
            'L/min',
            'Modeled flow accounting',
          ],
        ] as [string, number | null | undefined, string, string][])
      : []),
    ...(kind === 'pump-loading-lab' || kind === 'parameter-reader'
      ? ([['LV volume', m.lvedvMl, 'mL', 'Modeled volume']] as [
          string,
          number | null | undefined,
          string,
          string,
        ][])
      : []),
    ...(state.device.kind === 'lvad'
      ? ([
          ['Electrical pump power', m.pumpPowerW, 'W', 'Derived teaching value'],
          ['Pulsatility index', m.pulsatilityIndex, '', 'Derived teaching value'],
        ] as [string, number | null | undefined, string, string][])
      : []),
  ]
  return (
    <section aria-label="Current observations" data-task-readings>
      <h3>Current observations</h3>
      <dl className={styles.readings}>
        {fields.map(([label, value, unit, provenance]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {reading(value, unit === 'L/min' ? 2 : 1)} {unit}
              <small>{provenance}</small>
            </dd>
          </div>
        ))}
      </dl>
      {state.device.kind === 'iabp' ? <p>IABP has no separate pump-flow stream.</p> : null}
      <p>
        Patient examination, mentation, urine output, skin findings and lactate trends require
        bedside assessment; they are not simulated.
      </p>
    </section>
  )
}
