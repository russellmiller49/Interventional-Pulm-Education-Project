'use client'

import { Activity, Droplets, HeartPulse, Thermometer, Wind } from 'lucide-react'

import type { IcuObservation, IcuSimulationState } from '../engine'
import styles from './icu-simulation.module.css'

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function latestContinuousObservation(state: IcuSimulationState): IcuObservation | undefined {
  return [...state.observations]
    .reverse()
    .find(
      (observation) =>
        observation.assessmentId === 'continuous-monitor' &&
        observation.availableAtSeconds <= state.clock.elapsedSeconds,
    )
}

function latestPacObservation(state: IcuSimulationState): IcuObservation | undefined {
  return [...state.observations]
    .reverse()
    .find(
      (observation) =>
        observation.assessmentId === 'pac' &&
        observation.availableAtSeconds <= state.clock.elapsedSeconds,
    )
}

function observationNumber(
  observation: IcuObservation | undefined,
  keys: readonly string[],
  fallback: number,
) {
  for (const key of keys) {
    const value = observation?.values[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return fallback
}

function display(value: number, digits = 0): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function Waveform({
  kind,
  color,
  label,
  value,
  unit,
}: {
  kind: 'ecg' | 'arterial' | 'pleth' | 'respiratory'
  color: string
  label: string
  value: string
  unit: string
}) {
  const paths = {
    ecg: 'M0 30 L25 30 L30 27 L34 34 L39 8 L44 47 L50 29 L64 29 L72 23 L82 30 L110 30 L115 27 L119 34 L124 8 L129 47 L135 29 L149 29 L157 23 L167 30 L195 30 L200 27 L204 34 L209 8 L214 47 L220 29 L234 29 L242 23 L252 30 L280 30 L285 27 L289 34 L294 8 L299 47 L305 29 L319 29 L327 23 L337 30 L365 30 L370 27 L374 34 L379 8 L384 47 L390 29 L404 29 L412 23 L422 30 L450 30 L455 27 L459 34 L464 8 L469 47 L475 29 L489 29 L497 23 L507 30 L540 30',
    arterial:
      'M0 46 C14 46 17 18 31 10 C42 11 45 21 48 28 C54 32 58 29 64 28 C70 35 76 43 90 46 C105 46 108 18 122 10 C133 11 136 21 139 28 C145 32 149 29 155 28 C161 35 167 43 181 46 C196 46 199 18 213 10 C224 11 227 21 230 28 C236 32 240 29 246 28 C252 35 258 43 272 46 C287 46 290 18 304 10 C315 11 318 21 321 28 C327 32 331 29 337 28 C343 35 349 43 363 46 C378 46 381 18 395 10 C406 11 409 21 412 28 C418 32 422 29 428 28 C434 35 440 43 454 46 C469 46 472 18 486 10 C497 11 500 21 503 28 C509 32 513 29 519 28 C525 35 531 43 540 46',
    pleth:
      'M0 44 C12 44 17 18 32 15 C48 14 51 28 60 31 C66 33 69 29 75 28 C83 34 88 42 100 44 C112 44 117 18 132 15 C148 14 151 28 160 31 C166 33 169 29 175 28 C183 34 188 42 200 44 C212 44 217 18 232 15 C248 14 251 28 260 31 C266 33 269 29 275 28 C283 34 288 42 300 44 C312 44 317 18 332 15 C348 14 351 28 360 31 C366 33 369 29 375 28 C383 34 388 42 400 44 C412 44 417 18 432 15 C448 14 451 28 460 31 C466 33 469 29 475 28 C483 34 488 42 500 44 C512 44 517 18 532 15 C536 15 538 17 540 19',
    respiratory:
      'M0 34 C18 34 21 10 48 10 C72 10 76 34 96 34 C114 34 117 10 144 10 C168 10 172 34 192 34 C210 34 213 10 240 10 C264 10 268 34 288 34 C306 34 309 10 336 10 C360 10 364 34 384 34 C402 34 405 10 432 10 C456 10 460 34 480 34 C498 34 501 10 528 10 C533 10 537 11 540 13',
  } as const

  return (
    <figure className={styles.monitorWaveform}>
      <figcaption>
        <strong style={{ color }}>{label}</strong>
        <span>
          {value} <small>{unit}</small>
        </span>
      </figcaption>
      <svg viewBox="0 0 540 56" preserveAspectRatio="none" aria-hidden="true">
        <path
          d={paths[kind]}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </figure>
  )
}

export function IcuPatientMonitor({
  state,
  concealSyntheticId = false,
}: {
  state: IcuSimulationState
  concealSyntheticId?: boolean
}) {
  const observed = latestContinuousObservation(state)
  const pacObserved = latestPacObservation(state)
  const hemodynamics = state.patient.hemodynamics
  const respiratory = state.patient.respiratory
  const perfusion = state.patient.perfusion

  const values = {
    heartRate: observationNumber(
      observed,
      ['heartRateBpm', 'heartRate'],
      hemodynamics.heartRateBpm,
    ),
    systolic: observationNumber(observed, ['systolicMmHg', 'systolic'], hemodynamics.systolicMmHg),
    diastolic: observationNumber(
      observed,
      ['diastolicMmHg', 'diastolic'],
      hemodynamics.diastolicMmHg,
    ),
    map: observationNumber(observed, ['mapMmHg', 'map'], hemodynamics.mapMmHg),
    spo2: observationNumber(observed, ['spo2Percent', 'spo2'], respiratory.spo2Percent),
    respiratoryRate: observationNumber(
      observed,
      ['respiratoryRatePerMin', 'respiratoryRate'],
      respiratory.spontaneousRatePerMin,
    ),
    cardiacOutput: observationNumber(
      pacObserved,
      ['cardiacOutputLMin', 'cardiacOutput'],
      Number.NaN,
    ),
    temperature: observationNumber(observed, ['temperatureC'], perfusion.temperatureC),
    meanPap: observationNumber(pacObserved, ['meanPapMmHg', 'meanPap'], Number.NaN),
    rap: observationNumber(pacObserved, ['rapMmHg', 'cvpMmHg', 'cvp'], Number.NaN),
  }

  return (
    <section className={styles.patientMonitor} aria-labelledby="patient-monitor-title">
      <header className={styles.patientMonitorHeader}>
        <div>
          <span>ICU // SHARED PATIENT</span>
          <h2 id="patient-monitor-title">Synchronized bedside monitor</h2>
        </div>
        <div className={styles.monitorConnection}>
          <span aria-hidden="true" />
          All systems coupled
        </div>
        <time>{Math.floor(state.clock.elapsedSeconds / 60)} min</time>
      </header>

      <div className={styles.monitorGrid}>
        <div className={styles.waveformColumn}>
          <Waveform
            kind="ecg"
            color="#55dc94"
            label="ECG II"
            value={display(values.heartRate)}
            unit="bpm"
          />
          <Waveform
            kind="arterial"
            color="#ff667f"
            label="ART"
            value={`${display(values.systolic)}/${display(values.diastolic)}`}
            unit="mmHg"
          />
          <Waveform
            kind="pleth"
            color="#5ee3e4"
            label="PLETH"
            value={display(values.spo2)}
            unit="%"
          />
          <Waveform
            kind="respiratory"
            color="#f2c45d"
            label="RESP"
            value={display(values.respiratoryRate)}
            unit="/min"
          />
        </div>

        <dl className={styles.monitorNumerics} aria-label="Current observed patient values">
          <div data-tone="green">
            <dt>
              <HeartPulse aria-hidden="true" /> HR
            </dt>
            <dd>{display(values.heartRate)}</dd>
            <span>bpm</span>
          </div>
          <div data-tone="red">
            <dt>
              <Activity aria-hidden="true" /> MAP
            </dt>
            <dd>{display(values.map)}</dd>
            <span>mmHg</span>
          </div>
          <div data-tone="cyan">
            <dt>
              <Wind aria-hidden="true" /> SpO₂
            </dt>
            <dd>{display(values.spo2)}</dd>
            <span>%</span>
          </div>
          <div data-tone="amber">
            <dt>
              <Droplets aria-hidden="true" /> CO
            </dt>
            <dd>{display(values.cardiacOutput, 1)}</dd>
            <span>L/min</span>
          </div>
          <div data-tone="blue">
            <dt>RAP / mPAP</dt>
            <dd>
              {display(values.rap)}/{display(values.meanPap)}
            </dd>
            <span>mmHg</span>
          </div>
          <div data-tone="white">
            <dt>
              <Thermometer aria-hidden="true" /> Temp
            </dt>
            <dd>{display(values.temperature, 1)}</dd>
            <span>°C</span>
          </div>
        </dl>
      </div>

      <footer className={styles.monitorFooter}>
        <span>
          Synthetic patient{' '}
          {concealSyntheticId ? 'challenge variant' : state.patient.syntheticPatientId} · Adult{' '}
          {finite(state.patient.adultAgeYears, 0)} y · {finite(state.patient.weightKg, 0)} kg
        </span>
        <span>
          Displayed values are simulated observations · CO and filling pressures require PAC data
        </span>
      </footer>
    </section>
  )
}
