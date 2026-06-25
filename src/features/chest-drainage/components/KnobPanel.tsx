'use client'

import type { SimulationState } from '../engine/types'
import { MIN_DRY_SUCTION_SOURCE_FLOW_LPM } from '../engine/constants'
import { HandoffContent } from '@/i18n/handoff'

interface KnobPanelProps {
  state: SimulationState
  onPatientChange: (next: Partial<SimulationState['patient']>) => void
  onTubeChange: (next: Partial<SimulationState['tube']>) => void
  onDeviceChange: (next: Partial<SimulationState['device']>) => void
}

export function KnobPanel({
  state,
  onPatientChange,
  onTubeChange,
  onDeviceChange,
}: KnobPanelProps) {
  return (
    <HandoffContent>
      {
        <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Knobology lab</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Every control updates the same simulated circuit.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <RangeControl
              label="Dry suction target"
              value={Math.abs(state.device.suctionSettingCmH2O)}
              min={10}
              max={40}
              step={5}
              suffix="cm H2O"
              onChange={(value) => onDeviceChange({ suctionSettingCmH2O: -value })}
            />
            <RangeControl
              label="Source suction flow"
              value={state.device.sourceSuctionFlowLpm}
              min={0}
              max={25}
              step={1}
              suffix="L/min"
              onChange={(value) => onDeviceChange({ sourceSuctionFlowLpm: value })}
              formatter={(value) =>
                value >= MIN_DRY_SUCTION_SOURCE_FLOW_LPM
                  ? `${value} L/min ok`
                  : `${value} L/min low`
              }
            />
            <RangeControl
              label="Water seal fill"
              value={state.device.waterSealDepthCm}
              min={0}
              max={5}
              step={0.5}
              suffix="cm"
              onChange={(value) => onDeviceChange({ waterSealDepthCm: value })}
            />
            <RangeControl
              label="Air leak severity"
              value={state.patient.airLeakSeverity}
              min={0}
              max={1}
              step={0.05}
              suffix=""
              onChange={(value) => onPatientChange({ airLeakSeverity: value })}
              formatter={(value) => `${Math.round(value * 100)}%`}
            />
            <RangeControl
              label="Fluid production"
              value={state.patient.fluidProductionMlPerHr}
              min={0}
              max={240}
              step={10}
              suffix="mL/hr"
              onChange={(value) => onPatientChange({ fluidProductionMlPerHr: value })}
            />
            <RangeControl
              label="Collection chamber"
              value={state.device.collectionVolumeMl}
              min={0}
              max={2100}
              step={25}
              suffix="mL"
              onChange={(value) =>
                onDeviceChange({
                  collectionVolumeMl: value,
                  canisterFull: value >= 2000,
                })
              }
            />
            <RangeControl
              label="Tube patency"
              value={state.tube.patency}
              min={0}
              max={1}
              step={0.05}
              suffix=""
              onChange={(value) => onTubeChange({ patency: value })}
              formatter={(value) => `${Math.round(value * 100)}%`}
            />
            <RangeControl
              label="Unit below chest"
              value={state.device.heightBelowChestCm}
              min={0}
              max={80}
              step={5}
              suffix="cm"
              onChange={(value) => onDeviceChange({ heightBelowChestCm: value })}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ToggleControl
              label="Cough spike"
              pressed={state.patient.cough}
              onToggle={() => onPatientChange({ cough: !state.patient.cough })}
            />
            <ToggleControl
              label="Positive-pressure ventilation"
              pressed={state.patient.ventilation === 'positivePressure'}
              onToggle={() =>
                onPatientChange({
                  ventilation:
                    state.patient.ventilation === 'positivePressure'
                      ? 'spontaneous'
                      : 'positivePressure',
                })
              }
            />
            <ToggleControl
              label="Patient tube clamped"
              pressed={state.tube.clamped}
              onToggle={() => onTubeChange({ clamped: !state.tube.clamped })}
            />
            <ToggleControl
              label="Kink or dependent loop"
              pressed={state.tube.kinked || state.tube.dependentLoop}
              onToggle={() =>
                onTubeChange({
                  kinked: !(state.tube.kinked || state.tube.dependentLoop),
                  dependentLoop: !(state.tube.kinked || state.tube.dependentLoop),
                })
              }
            />
            <ToggleControl
              label="Unit upright"
              pressed={state.device.upright}
              onToggle={() => onDeviceChange({ upright: !state.device.upright })}
            />
            <ToggleControl
              label="Side holes in chest"
              pressed={state.tube.sideHolesInChest}
              onToggle={() => onTubeChange({ sideHolesInChest: !state.tube.sideHolesInChest })}
            />
          </div>
        </section>
      }
    </HandoffContent>
  )
}

interface RangeControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  formatter?: (value: number) => string
  onChange: (value: number) => void
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix,
  formatter,
  onChange,
}: RangeControlProps) {
  return (
    <HandoffContent>
      {
        <label className="grid gap-2 text-sm">
          <span className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">{label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {formatter ? formatter(value) : `${value}${suffix ? ` ${suffix}` : ''}`}
            </span>
          </span>
          <input
            type="range"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-sky-600"
          />
        </label>
      }
    </HandoffContent>
  )
}

interface ToggleControlProps {
  label: string
  pressed: boolean
  onToggle: () => void
}

function ToggleControl({ label, pressed, onToggle }: ToggleControlProps) {
  return (
    <HandoffContent>
      {
        <button
          type="button"
          aria-pressed={pressed}
          onClick={onToggle}
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-sky-500 aria-pressed:bg-sky-500/10"
        >
          <span className="font-medium text-foreground">{label}</span>
          <span
            className={
              pressed
                ? 'rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white'
                : 'rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground'
            }
          >
            {pressed ? 'On' : 'Off'}
          </span>
        </button>
      }
    </HandoffContent>
  )
}
