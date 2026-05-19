'use client'

import { RotateCcw } from 'lucide-react'
import Image from 'next/image'
import { useMemo, useState } from 'react'

import { drySealHotspots } from '../content/drySealHotspots'
import { MAX_COLLECTION_VOLUME_ML, defaultSimulationState } from '../engine/constants'
import { getDrainageAlarms } from '../engine/alarms'
import { buildTrendSeries, clamp, summarizePhysiology } from '../engine/pleuralPhysics'
import type { SimulationState } from '../engine/types'
import { KnobPanel } from './KnobPanel'
import { PressureTrendChart } from './PressureTrendChart'

export function DrySealDrainageSimulator() {
  const [state, setState] = useState<SimulationState>(defaultSimulationState)
  const [selectedHotspotId, setSelectedHotspotId] = useState('dry-suction-regulator')
  const summary = useMemo(() => summarizePhysiology(state), [state])
  const alarms = useMemo(() => getDrainageAlarms(state), [state])
  const trendSeries = useMemo(() => buildTrendSeries(state), [state])
  const selectedHotspot =
    drySealHotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? drySealHotspots[0]

  const updatePatient = (next: Partial<SimulationState['patient']>) => {
    setState((current) => ({
      ...current,
      patient: { ...current.patient, ...next },
    }))
  }

  const updateTube = (next: Partial<SimulationState['tube']>) => {
    setState((current) => ({
      ...current,
      tube: { ...current.tube, ...next },
    }))
  }

  const updateDevice = (next: Partial<SimulationState['device']>) => {
    setState((current) => ({
      ...current,
      device: { ...current.device, ...next },
    }))
  }

  const suctionNeedleAngle = -58 + ((Math.abs(state.device.suctionSettingCmH2O) - 10) / 30) * 118
  const waterSealHeight = clamp((state.device.waterSealDepthCm / 5) * 100, 0, 100)
  const floatTop = 75.6 + summary.patientPressureFloatCmH2O * 1.25

  return (
    <section className="container space-y-8" aria-labelledby="dry-seal-simulator-title">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="dry-seal-simulator-title" className="text-2xl font-bold tracking-tight">
                Dry Seal Drainage System Simulator
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Use the clean device illustration as the circuit surface. Hotspots match the labeled
                guide and controls animate the chamber, air leak monitor, suction indicator, float,
                and clamp state.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setState(defaultSimulationState)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.86fr)_minmax(260px,0.44fr)]">
            <div
              className="relative mx-auto aspect-[1079/1457] max-h-[780px] w-full overflow-hidden rounded-lg border border-border/80 bg-white shadow-inner"
              aria-label="Interactive clean dry seal chest drainage unit image with animated overlays"
            >
              <Image
                src="/pleural-procedures/clean-dry-seal-cartoon.png"
                alt="Clean dry seal chest drainage system illustration"
                width={1079}
                height={1457}
                priority
                className="h-full w-full object-contain"
                draggable={false}
              />

              <CollectionFillOverlay collectionVolumeMl={state.device.collectionVolumeMl} />
              <WaterSealOverlay fillPercent={waterSealHeight} />
              <AirLeakBubbles level={summary.airLeakMeterLevel} />
              <SuctionBellows active={summary.suctionIndicatorPresent} />
              <SuctionNeedle angle={suctionNeedleAngle} />
              <PatientPressureFloat topPercent={floatTop} />
              <ClampOverlay clamped={state.tube.clamped} />

              {drySealHotspots.map((hotspot, index) => (
                <button
                  key={hotspot.id}
                  type="button"
                  aria-label={`Show knobology for ${hotspot.label}`}
                  aria-pressed={selectedHotspot.id === hotspot.id}
                  onClick={() => setSelectedHotspotId(hotspot.id)}
                  className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-sky-600 text-[11px] font-bold text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-orange-500 motion-reduce:transition-none"
                  style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg border border-border/80 bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected labeled item
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {selectedHotspot.label}
                </h3>
                <dl className="mt-4 space-y-3 text-sm leading-6">
                  <div>
                    <dt className="font-semibold text-foreground">Role</dt>
                    <dd className="text-muted-foreground">{selectedHotspot.role}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Knobology</dt>
                    <dd className="text-muted-foreground">{selectedHotspot.knobology}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Caution</dt>
                    <dd className="text-muted-foreground">{selectedHotspot.caution}</dd>
                  </div>
                </dl>
              </div>

              <div className="grid gap-3 rounded-lg border border-border/80 bg-background p-4 text-sm">
                <Reading
                  label="Effective suction"
                  value={`${summary.effectiveSuctionCmH2O} cm H2O`}
                />
                <Reading label="Air leak display" value={`${summary.digitalAirLeakMlMin} mL/min`} />
                <Reading label="Bubbling level" value={`${summary.airLeakMeterLevel} / 5`} />
                <Reading label="Fluid output" value={`${summary.drainageFlowMlPerHr} mL/hr`} />
                <Reading label="Collection" value={`${state.device.collectionVolumeMl} mL`} />
                <Reading
                  label="Re-expansion risk model"
                  value={`${Math.round(summary.reExpansionRisk * 100)}%`}
                />
              </div>

              <div className="rounded-lg border border-border/80 bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">Text equivalent</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground" aria-live="polite">
                  Water seal depth is {state.device.waterSealDepthCm} cm. Collection chamber is{' '}
                  {Math.round(summary.fluidCollectionPercent)}% filled. Suction indicator is{' '}
                  {summary.suctionIndicatorPresent ? 'present' : 'absent'}. Patient tube is{' '}
                  {state.tube.clamped ? 'clamped' : 'open'}.
                </p>
              </div>
            </aside>
          </div>
        </div>

        <div className="space-y-6">
          <KnobPanel
            state={state}
            onPatientChange={updatePatient}
            onTubeChange={updateTube}
            onDeviceChange={updateDevice}
          />

          <div className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="text-base font-semibold text-foreground">Alarms and warnings</h3>
            {alarms.length ? (
              <ul className="mt-4 space-y-3">
                {alarms.map((alarm) => (
                  <li
                    key={alarm.id}
                    className={
                      alarm.severity === 'danger'
                        ? 'rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-400/40 dark:bg-red-950/30 dark:text-red-100'
                        : 'rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100'
                    }
                  >
                    <span className="font-semibold">{alarm.title}: </span>
                    {alarm.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                No active warning in the current modeled state.
              </p>
            )}
          </div>

          <PressureTrendChart series={trendSeries} />
        </div>
      </div>
    </section>
  )
}

function CollectionFillOverlay({ collectionVolumeMl }: { collectionVolumeMl: number }) {
  const chambers = [
    {
      id: 'overflow-high-volume',
      left: 45.8,
      top: 18.5,
      width: 6.3,
      height: 60.8,
      startMl: 1100,
      endMl: MAX_COLLECTION_VOLUME_ML,
    },
    {
      id: 'overflow-mid-volume',
      left: 60.8,
      top: 18.5,
      width: 6.5,
      height: 60.8,
      startMl: 200,
      endMl: 1100,
    },
    {
      id: 'first-low-volume',
      left: 75.2,
      top: 18.5,
      width: 6.5,
      height: 60.8,
      startMl: 0,
      endMl: 200,
    },
  ]

  return (
    <>
      {chambers.map((chamber) => {
        const chamberFillPercent = clamp(
          ((collectionVolumeMl - chamber.startMl) / (chamber.endMl - chamber.startMl)) * 100,
          0,
          100,
        )

        return (
          <div
            key={chamber.id}
            aria-hidden
            className="pointer-events-none absolute z-10 overflow-hidden rounded-sm"
            style={{
              left: `${chamber.left}%`,
              top: `${chamber.top}%`,
              width: `${chamber.width}%`,
              height: `${chamber.height}%`,
            }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-sky-500/45 to-cyan-300/30 transition-[height] duration-500 motion-reduce:transition-none"
              style={{ height: `${chamberFillPercent}%` }}
            />
          </div>
        )
      })}
    </>
  )
}

function WaterSealOverlay({ fillPercent }: { fillPercent: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 overflow-hidden rounded-b-lg"
      style={{
        left: '11.6%',
        top: '62.5%',
        width: '18.4%',
        height: '17.2%',
        clipPath: 'polygon(0 37%, 100% 0, 100% 100%, 0 100%)',
      }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600/55 to-sky-300/40 transition-[height] duration-500 motion-reduce:transition-none"
        style={{ height: `${fillPercent}%` }}
      />
      <div className="absolute left-0 right-0 top-[32%] border-t-2 border-dashed border-white/85" />
    </div>
  )
}

function AirLeakBubbles({ level }: { level: number }) {
  const bubbles = [
    { left: 15.3, top: 76.2, size: 9 },
    { left: 18.2, top: 74.8, size: 7 },
    { left: 20.9, top: 73.6, size: 8 },
    { left: 23.5, top: 72.3, size: 6 },
    { left: 25.7, top: 70.7, size: 8 },
  ]

  return (
    <>
      {bubbles.map((bubble, index) =>
        index < level ? (
          <span
            key={`${bubble.left}-${bubble.top}`}
            aria-hidden
            className="pointer-events-none absolute z-20 rounded-full border border-white/90 bg-white/80 shadow-sm animate-bounce motion-reduce:animate-none"
            style={{
              left: `${bubble.left}%`,
              top: `${bubble.top}%`,
              width: bubble.size,
              height: bubble.size,
              animationDelay: `${index * 120}ms`,
              animationDuration: `${900 + index * 90}ms`,
            }}
          />
        ) : null,
      )}
    </>
  )
}

function SuctionBellows({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={
        active
          ? 'pointer-events-none absolute z-10 rounded-md border border-red-300/80 bg-red-500/20 shadow-[0_0_24px_rgba(239,68,68,0.45)] animate-pulse motion-reduce:animate-none'
          : 'pointer-events-none absolute z-10 rounded-md border border-slate-400/50 bg-slate-500/35 grayscale'
      }
      style={{ left: '19.4%', top: '35.5%', width: '6.1%', height: '8.7%' }}
    />
  )
}

function SuctionNeedle({ angle }: { angle: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20"
      style={{ left: '18.0%', top: '28.4%', width: '9.3%', height: '9.3%' }}
    >
      <span
        className="absolute left-1/2 top-1/2 h-[48%] w-[10%] origin-bottom rounded-full bg-red-600 shadow-sm"
        style={{
          transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          transformOrigin: '50% 100%',
        }}
      />
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-700" />
    </div>
  )
}

function PatientPressureFloat({ topPercent }: { topPercent: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-20 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-white bg-slate-950 shadow-lg transition-[top] duration-500 motion-reduce:transition-none"
      style={{ left: '27.4%', top: `${topPercent}%` }}
    />
  )
}

function ClampOverlay({ clamped }: { clamped: boolean }) {
  if (!clamped) {
    return null
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 rotate-[-14deg] rounded-lg border-2 border-red-600 bg-red-500/20"
      style={{ left: '66.5%', top: '85.6%', width: '14.5%', height: '9.5%' }}
    >
      <span className="absolute left-1/2 top-1/2 h-[150%] w-1 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-red-600" />
      <span className="absolute left-1/2 top-1/2 h-[150%] w-1 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-red-600" />
    </div>
  )
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  )
}
