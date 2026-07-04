'use client'

import { Badge } from '@/components/ui/badge'
import { DEPTH_FULL_SCALE_MM, useScopeInput } from '@/lib/scope-input'
import type { ScopeButtonName } from '@/lib/scope-input'

import { SectionCard } from './SectionCard'

const BUTTON_LABELS: Array<{ key: ScopeButtonName; label: string }> = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
  { key: 'c', label: 'C' },
  { key: 'd', label: 'D' },
  { key: 'calibrate', label: 'CAL' },
]

function CenteredBar({ value }: { value: number }) {
  const percent = ((value + 1) / 2) * 100
  return (
    <div className="relative h-3 w-full rounded-full bg-muted">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
      <div
        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow"
        style={{ left: `${percent}%` }}
        aria-hidden
      />
    </div>
  )
}

function FillBar({ fraction }: { fraction: number }) {
  const percent = Math.min(100, Math.max(0, fraction * 100))
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary/80" style={{ width: `${percent}%` }} />
    </div>
  )
}

function RollDial({ rollRad, turns }: { rollRad: number; turns: number }) {
  const x2 = 50 + 36 * Math.sin(rollRad)
  const y2 = 50 - 36 * Math.cos(rollRad)
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" aria-hidden>
        <circle cx="50" cy="50" r="44" className="fill-muted stroke-border" strokeWidth="2" />
        <line x1="50" y1="8" x2="50" y2="16" className="stroke-muted-foreground" strokeWidth="2" />
        <line
          x1="50"
          y1="50"
          x2={x2}
          y2={y2}
          className="stroke-primary"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="5" className="fill-primary" />
      </svg>
      <div className="text-sm text-muted-foreground">
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {((rollRad * 180) / Math.PI).toFixed(0)}°
        </div>
        <div className="tabular-nums">{turns.toFixed(2)} total turns</div>
      </div>
    </div>
  )
}

export function LiveMonitor() {
  const { frame, connected, deviceId, sourceKind } = useScopeInput()

  return (
    <SectionCard
      title="Connection & live signals"
      description="Runtime input arrives as a USB HID gamepad — no drivers, no serial connection needed."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={connected ? 'success' : 'outline'}>
          {connected ? 'Connected' : 'Waiting for device'}
        </Badge>
        {connected && sourceKind === 'virtual' ? <Badge variant="info">Emulator</Badge> : null}
        {deviceId ? (
          <span className="truncate text-xs text-muted-foreground" title={deviceId}>
            {deviceId}
          </span>
        ) : null}
      </div>

      {!connected ? (
        <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
          Plug the tracker in over USB and <strong>press any of its buttons once</strong> — browsers
          only expose a gamepad after a button press. No hardware yet? Enable the emulator below to
          exercise the whole pipeline.
        </p>
      ) : null}

      {frame?.status.fault ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
          Hardware fault reported. Connect the serial diagnostics below for details.
        </p>
      ) : null}
      {frame?.status.lowQuality ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Low optical tracking quality — replace the wiper ring, wipe the cord, or check the insert
          cassette.
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">Flexion</span>
            <span className="tabular-nums text-muted-foreground">
              {(frame?.flexion ?? 0).toFixed(3)}
            </span>
          </div>
          <CenteredBar value={frame?.flexion ?? 0} />
          <div className="flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Tip down</span>
            <span>Neutral</span>
            <span>Tip up</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium text-foreground">Insertion depth</span>
            <span className="tabular-nums text-muted-foreground">
              {(frame?.depthMm ?? 0).toFixed(1)} mm
            </span>
          </div>
          <FillBar fraction={(frame?.depthMm ?? 0) / DEPTH_FULL_SCALE_MM} />
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-foreground">Roll</span>
          <RollDial
            rollRad={frame?.rollRad ?? 0}
            turns={(frame?.rollContinuousRad ?? 0) / (Math.PI * 2)}
          />
          {frame && !frame.rollValid ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Roll axes not valid yet — holding the last good value.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {BUTTON_LABELS.map(({ key, label }) => (
            <span
              key={key}
              className={
                frame?.buttons[key]
                  ? 'rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground'
                  : 'rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground'
              }
            >
              {label}
            </span>
          ))}
          <span
            className={
              frame?.status.photogate
                ? 'rounded-md border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                : 'rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground'
            }
          >
            Photogate
          </span>
        </div>
      </div>
    </SectionCard>
  )
}
