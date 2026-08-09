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
 * The live pressure profile and the universal circuit, driven by one running
 * model and one selection.
 *
 * The blood-flow control exists to make one point available directly: the same
 * circuit, with nothing obstructed and nothing else changed, reports different
 * pressures at a different pump setting. Both settings come from continuing the
 * same run, so the recorded history carries the change rather than hiding it.
 *
 * Every number on both halves comes from the same adapter view, so the profile
 * and the circuit cannot disagree about the same quantity.
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
          <span>Live educational model</span>
          <h3 id="crrt-live-pressure-station-heading">Pressure profile and circuit</h3>
        </div>
        <div
          className={styles.flowControl}
          role="group"
          aria-label="Blood flow setting for this running case"
        >
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
        Nothing is obstructed in either setting and nothing else has been changed. Watch which
        channels move when the pump setting changes — and which one does not.
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
