'use client'

import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { ProbeControlRange, ProbePreset, ProbeStateKey, ThoracicCaseManifest } from '../types'
import type { ProbeStore } from '../state/probeStore'
import { useProbeState } from '../state/probeStore'
import { HandoffContent } from '@/i18n/handoff'

interface ThoracicProbeControlsProps {
  manifest: ThoracicCaseManifest
  store: ProbeStore
}

interface ControlDef {
  key: ProbeStateKey
  label: string
  unit: string
}

const positionControls: ControlDef[] = [
  { key: 'approachDeg', label: 'Approach (around body)', unit: 'deg' },
  { key: 'lateralMm', label: 'Lateral position', unit: 'mm' },
  { key: 'craniocaudalMm', label: 'Cranial/caudal position', unit: 'mm' },
  { key: 'tiltDeg', label: 'Cranial/caudal tilt', unit: 'deg' },
  { key: 'rotationDeg', label: 'Marker rotation', unit: 'deg' },
  { key: 'needleAngleDeg', label: 'Guide line', unit: 'deg' },
]

const imagingControls: ControlDef[] = [
  { key: 'depthCm', label: 'Depth', unit: 'cm' },
  { key: 'gain', label: 'Gain', unit: 'x' },
  { key: 'sectorAngleDeg', label: 'Fan', unit: 'deg' },
]

export function activeProbePreset(manifest: ThoracicCaseManifest): ProbePreset {
  return (
    manifest.probePresets.find((preset) => preset.id === manifest.defaultProbePresetId) ??
    manifest.probePresets[0]
  )
}

export function ThoracicProbeControls({ manifest, store }: ThoracicProbeControlsProps) {
  const probe = useProbeState(store)
  const preset = activeProbePreset(manifest)

  function controlRange(key: ProbeStateKey): ProbeControlRange | null {
    return preset.ranges[key] ?? null
  }

  return (
    <HandoffContent>
      {
        <article className="rounded-lg border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Probe controls</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Move along the surface, then refine depth, gain, fan, tilt, and the guide line.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Reset probe"
              onClick={() => store.replaceState(preset.defaults)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-5 grid gap-4">
            {positionControls.map((control) => {
              const range = controlRange(control.key)
              if (!range) {
                return null
              }
              return (
                <Slider
                  key={control.key}
                  label={control.label}
                  value={probe[control.key] ?? 0}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  unit={control.unit}
                  onChange={(value) => store.setState({ [control.key]: value })}
                />
              )
            })}
            <div className="grid gap-4 sm:grid-cols-3">
              {imagingControls.map((control) => {
                const range = controlRange(control.key)
                if (!range) {
                  return null
                }
                return (
                  <Slider
                    key={control.key}
                    label={control.label}
                    value={probe[control.key] ?? 0}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    unit={control.unit}
                    onChange={(value) =>
                      store.setState({
                        [control.key]: Math.min(range.max, Math.max(range.min, value)),
                      })
                    }
                  />
                )
              })}
            </div>
          </div>
        </article>
      }
    </HandoffContent>
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
    <HandoffContent>
      {
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
      }
    </HandoffContent>
  )
}
