'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { VirtualScopeSource, useScopeInputStore } from '@/lib/scope-input'
import type { ScopeButtonName } from '@/lib/scope-input'

import { SectionCard } from './SectionCard'

const PULSE_BUTTONS: Array<{ key: ScopeButtonName; label: string }> = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
  { key: 'calibrate', label: 'CAL' },
]

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.toFixed(step < 1 ? 2 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-[hsl(var(--primary))]"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
      />
    </div>
  )
}

export function EmulatorPanel() {
  const store = useScopeInputStore()
  const virtualRef = useRef<VirtualScopeSource | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [flexion, setFlexion] = useState(0)
  const [depthMm, setDepthMm] = useState(0)
  const [rollDeg, setRollDeg] = useState(0)
  const [lowQuality, setLowQuality] = useState(false)

  useEffect(() => {
    if (enabled) {
      if (!virtualRef.current) virtualRef.current = new VirtualScopeSource()
      store.setVirtualSource(virtualRef.current)
    } else {
      store.setVirtualSource(null)
    }
    return () => {
      store.setVirtualSource(null)
    }
  }, [enabled, store])

  useEffect(() => {
    virtualRef.current?.set({
      flexion,
      depthMm,
      rollRad: (rollDeg * Math.PI) / 180,
    })
  }, [flexion, depthMm, rollDeg])

  useEffect(() => {
    virtualRef.current?.setStatus({ lowQuality })
  }, [lowQuality])

  return (
    <SectionCard
      title="Emulator"
      description="Drive the exact input pipeline without hardware — useful for trying the simulators before the tracker is built."
    >
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[hsl(var(--primary))]"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        Enable emulated scope tracker
      </label>

      {enabled ? (
        <div className="space-y-4">
          <SliderRow
            label="Flexion"
            value={flexion}
            min={-1}
            max={1}
            step={0.01}
            unit=""
            onChange={setFlexion}
          />
          <SliderRow
            label="Insertion depth"
            value={depthMm}
            min={0}
            max={600}
            step={1}
            unit="mm"
            onChange={setDepthMm}
          />
          <SliderRow
            label="Roll"
            value={rollDeg}
            min={-720}
            max={720}
            step={1}
            unit="°"
            onChange={setRollDeg}
          />
          <div className="flex flex-wrap items-center gap-2">
            {PULSE_BUTTONS.map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                onClick={() => virtualRef.current?.pulseButton(key)}
              >
                Press {label}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              checked={lowQuality}
              onChange={(event) => setLowQuality(event.target.checked)}
            />
            Simulate low tracking quality (SQUAL warning)
          </label>
          <p className="text-xs text-muted-foreground">
            The emulator is local to this page — it validates decoding, shaping, and profiles. The
            simulators poll the physical device directly; without hardware they still work through
            their built-in on-screen controls.
          </p>
        </div>
      ) : null}
    </SectionCard>
  )
}
