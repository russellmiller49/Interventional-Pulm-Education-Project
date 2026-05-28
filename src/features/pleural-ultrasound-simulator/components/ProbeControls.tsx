'use client'

import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { PleuralProbeState, PleuralSimulatorCase } from '../types'

interface ProbeControlsProps {
  caseData: PleuralSimulatorCase
  probe: PleuralProbeState
  onChange: (next: PleuralProbeState) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function ProbeControls({ caseData, probe, onChange }: ProbeControlsProps) {
  const bounds = caseData.labelBoundsLpsMm.pleuralFluid ?? caseData.labelBoundsLpsMm.skin
  const skin = caseData.labelBoundsLpsMm.skin
  const lateralMin = bounds ? Math.floor(bounds.min[0] - 50) : -160
  const lateralMax = bounds ? Math.ceil(bounds.max[0] + 50) : 170
  const cranialMin = bounds ? Math.floor(bounds.min[2] - 45) : -500
  const cranialMax = bounds ? Math.ceil(bounds.max[2] + 45) : -180
  const posteriorMin = skin ? Math.floor(skin.max[1] - 60) : -110
  const posteriorMax = skin ? Math.ceil(skin.max[1] + 18) : -15

  function update<K extends keyof PleuralProbeState>(key: K, value: PleuralProbeState[K]) {
    onChange({ ...probe, [key]: value })
  }

  return (
    <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Probe controls</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Move along the chest wall, then refine depth, gain, fan, tilt, and needle line.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Reset probe"
          onClick={() => onChange(caseData.probeDefaults)}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-5 grid gap-4">
        <Slider
          label="Lateral position"
          value={probe.lateralMm}
          min={lateralMin}
          max={lateralMax}
          step={2}
          unit="mm"
          onChange={(value) => update('lateralMm', value)}
        />
        <Slider
          label="Posterior contact"
          value={probe.posteriorMm}
          min={posteriorMin}
          max={posteriorMax}
          step={2}
          unit="mm"
          onChange={(value) => update('posteriorMm', value)}
        />
        <Slider
          label="Cranial/caudal position"
          value={probe.craniocaudalMm}
          min={cranialMin}
          max={cranialMax}
          step={2}
          unit="mm"
          onChange={(value) => update('craniocaudalMm', value)}
        />
        <Slider
          label="Cranial/caudal tilt"
          value={probe.tiltDeg}
          min={-28}
          max={28}
          step={1}
          unit="deg"
          onChange={(value) => update('tiltDeg', value)}
        />
        <Slider
          label="Marker rotation"
          value={probe.rotationDeg}
          min={-55}
          max={55}
          step={1}
          unit="deg"
          onChange={(value) => update('rotationDeg', value)}
        />
        <Slider
          label="Needle line"
          value={probe.needleAngleDeg}
          min={-25}
          max={25}
          step={1}
          unit="deg"
          onChange={(value) => update('needleAngleDeg', value)}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider
            label="Depth"
            value={probe.depthCm}
            min={6}
            max={18}
            step={0.5}
            unit="cm"
            onChange={(value) => update('depthCm', value)}
          />
          <Slider
            label="Gain"
            value={probe.gain}
            min={0.7}
            max={2.4}
            step={0.05}
            unit="x"
            onChange={(value) => update('gain', value)}
          />
          <Slider
            label="Fan"
            value={probe.sectorAngleDeg}
            min={40}
            max={80}
            step={1}
            unit="deg"
            onChange={(value) => update('sectorAngleDeg', clamp(value, 40, 80))}
          />
        </div>
      </div>
    </article>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-sky-600"
      />
    </label>
  )
}
