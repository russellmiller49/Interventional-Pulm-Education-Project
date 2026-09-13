'use client'

import { useMemo, useState } from 'react'

import type { CrrtPressureSignalId } from '../content/circuitModel'
import {
  createInitialPrismaxPilotInterfaceState,
  selectPrismaxPilotCaseOperationsDisplay,
} from '../engine/deviceAdapters/prismax'
import { crrtLivePressureStationSettings } from '../livePressureStationModel'
import { CrrtLivePressureDevice } from './CrrtLivePressureDevice'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import styles from './crrt-live-pressure-station.module.css'

/**
 * Two engine-generated snapshots from the same recorded run, selected together for the device
 * profile and canonical circuit. Their different elapsed times are visible; they do not isolate
 * the blood-flow setting from filter age and recorded delivery.
 */
const deviceInterfaceState = createInitialPrismaxPilotInterfaceState()

export function CrrtLivePressureStation() {
  const settings = useMemo(() => crrtLivePressureStationSettings(), [])
  const [settingId, setSettingId] = useState(settings[0].id)
  const [selectedSignalId, setSelectedSignalId] = useState<CrrtPressureSignalId>('access')

  const setting = settings.find((candidate) => candidate.id === settingId) ?? settings[0]
  const operations = useMemo(
    () => selectPrismaxPilotCaseOperationsDisplay(deviceInterfaceState, setting.state),
    [setting],
  )

  const context = operations.treatmentContext

  return (
    <section className={styles.station} aria-labelledby="crrt-live-pressure-station-heading">
      <header className={styles.stationHeader}>
        <div>
          <span>Engine-generated recorded comparison</span>
          <h3 id="crrt-live-pressure-station-heading">Pressure profile and circuit</h3>
        </div>
        <div className={styles.flowControl} role="group" aria-label="Recorded blood-flow snapshots">
          {settings.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={candidate.id === setting.id}
              data-selected={candidate.id === setting.id}
              onClick={() => setSettingId(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </header>

      <p className={styles.flowNote}>
        These are two recorded synthetic snapshots, not a continuously running learner-controlled
        session: baseline at four hours, then higher blood flow at five hours. Both the setting and
        elapsed time differ, so filter age and recorded delivery can also differ. This is not an
        isolated blood-flow effect. Selecting a snapshot does not apply a device prescription.
      </p>

      <CrrtLivePressureDevice
        operations={operations}
        selectedSignalId={selectedSignalId}
        onSelectSignal={setSelectedSignalId}
      >
        <div className={styles.circuitSlot}>
          <p className={styles.circuitLead}>
            The same circuit you have been tracing, with the selected pressure marked where it is
            read. A calculated relationship marks the sites it is built from, because it has no
            place of its own.
          </p>
          <CrrtPilotCircuit
            running={context.bloodFlowContributesToPressures}
            setReady={true}
            fluidsReady={true}
            bloodFlowMlMin={context.bloodFlowMlMin}
            dialysateFlowMlHour={context.dialysateFlowMlHour}
            patientFluidRemovalMlHour={context.patientFluidRemovalMlHour}
            flows={operations.flows}
            initialOverlayId="pressure-profile"
            highlightedSignalId={selectedSignalId}
            pressure={{
              access: operations.pressures.accessPressureMmHg,
              filter: operations.pressures.filterPressureMmHg,
              return: operations.pressures.returnPressureMmHg,
              effluent: operations.pressures.effluentPressureMmHg,
              TMP: operations.pressures.transmembranePressureMmHg,
              filterDrop: operations.pressures.filterPressureDropMmHg,
            }}
          />
        </div>
      </CrrtLivePressureDevice>
    </section>
  )
}
