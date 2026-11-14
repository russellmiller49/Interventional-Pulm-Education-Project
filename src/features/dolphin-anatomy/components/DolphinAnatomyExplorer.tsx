'use client'

import { Component, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/cn'

import {
  DOLPHIN_STRUCTURES,
  ENVELOPE_OPACITY,
  HIDDEN_AT_START,
  SYSTEMS,
  formatVolume,
  type DolphinStructure,
} from '../content/structures'
import { DOLPHIN_VIEWS, DolphinScene, type DolphinViewName } from './DolphinScene'

const BODY_SURFACE = 'body-surface'
const DEFAULT_SURFACE_OPACITY = ENVELOPE_OPACITY[BODY_SURFACE]

function startingVisibility(): Record<string, boolean> {
  return Object.fromEntries(DOLPHIN_STRUCTURES.map((s) => [s.id, !HIDDEN_AT_START.has(s.id)]))
}

const rowId = (id: string) => `dolphin-structure-${id}`

const swatch = (color: DolphinStructure['color']) =>
  `rgb(${color.map((c) => Math.round(c * 255)).join(' ')})`

export function DolphinAnatomyExplorer() {
  const [visible, setVisible] = useState<Record<string, boolean>>(startingVisibility)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [surfaceOpacity, setSurfaceOpacity] = useState(DEFAULT_SURFACE_OPACITY)
  const [view, setView] = useState<{ name: DolphinViewName; serial: number }>({
    name: 'right',
    serial: 0,
  })

  const selected = useMemo(
    () => DOLPHIN_STRUCTURES.find((structure) => structure.id === selectedId) ?? null,
    [selectedId],
  )
  const bySystem = useMemo(
    () =>
      SYSTEMS.map((system) => ({
        ...system,
        structures: DOLPHIN_STRUCTURES.filter((structure) => structure.system === system.id),
      })),
    [],
  )

  const select = useCallback((id: string) => {
    setSelectedId(id)
    setVisible((current) => (current[id] ? current : { ...current, [id]: true }))
    // A structure picked on the model comes into view in the list.
    document.getElementById(rowId(id))?.scrollIntoView({ block: 'nearest' })
  }, [])
  const showOnly = (id: string) =>
    setVisible(
      Object.fromEntries(
        DOLPHIN_STRUCTURES.map((s) => [s.id, s.id === id || s.id === BODY_SURFACE]),
      ),
    )
  const showAll = () => setVisible(startingVisibility())
  const goTo = (name: DolphinViewName) =>
    setView((current) => ({ name, serial: current.serial + 1 }))

  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-var(--site-header-height)-4.25rem)] lg:min-h-[600px] lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
      <section
        aria-live="polite"
        className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm lg:col-start-1 lg:row-start-1"
      >
        {selected ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SYSTEMS.find((system) => system.id === selected.system)?.label}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">{selected.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.note}</p>
            {selected.id !== BODY_SURFACE && (
              <p className="mt-2 text-xs text-muted-foreground">
                Volume in this animal:{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {formatVolume(selected.volumeMl)}
                </span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => showOnly(selected.id)}
              >
                Show only this
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={showAll}>
                Show everything
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-foreground">A bottlenose dolphin, from CT</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Click a structure on the model or choose it in the list to read about it. Drag to
              rotate, scroll to zoom and right-drag to move the model. The body surface is
              see-through; set how much with the slider over the model.
            </p>
          </>
        )}
      </section>

      <div className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-muted/50 to-background shadow-sm lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:min-h-0">
        <ModelBoundary>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading the 3D model…
              </div>
            }
          >
            <DolphinScene
              visible={visible}
              surfaceOpacity={visible[BODY_SURFACE] ? surfaceOpacity : 0}
              selectedId={selectedId}
              view={view}
              onPick={select}
            />
          </Suspense>
        </ModelBoundary>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-center gap-2">
          {(Object.keys(DOLPHIN_VIEWS) as DolphinViewName[]).map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={view.name === name ? 'default' : 'outline'}
              className="pointer-events-auto h-8 px-3 text-xs"
              onClick={() => goTo(name)}
            >
              {DOLPHIN_VIEWS[name].label}
            </Button>
          ))}
          <label className="pointer-events-auto flex h-8 items-center gap-2 rounded-full border border-input bg-background px-3 text-xs shadow-sm">
            Body surface
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={visible[BODY_SURFACE] ? surfaceOpacity : 0}
              onChange={(event) => {
                const value = Number(event.target.value)
                setSurfaceOpacity(value)
                setVisible((current) => ({ ...current, [BODY_SURFACE]: value > 0 }))
              }}
              className="w-24 accent-primary"
              aria-label="Body surface opacity"
            />
          </label>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/85 px-2 py-1 text-xs text-muted-foreground">
          {DOLPHIN_VIEWS[view.name].caption}
        </p>
      </div>

      <nav
        aria-label="Structures"
        className="min-h-0 space-y-4 overflow-y-auto rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm lg:col-start-1 lg:row-start-2"
      >
        {bySystem.map((system) => {
          const anyShown = system.structures.some((structure) => visible[structure.id])
          return (
            <section key={system.id} className="space-y-1">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {system.label}
                </h3>
                <button
                  type="button"
                  className="rounded px-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    setVisible((current) => ({
                      ...current,
                      ...Object.fromEntries(
                        system.structures.map((structure) => [structure.id, !anyShown]),
                      ),
                    }))
                  }
                >
                  {anyShown ? 'Hide all' : 'Show all'}
                </button>
              </div>
              <ul className="space-y-0.5">
                {system.structures.map((structure) => (
                  <li
                    key={structure.id}
                    id={rowId(structure.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-1.5 py-1',
                      structure.id === selectedId
                        ? 'bg-primary/10 ring-1 ring-primary/40'
                        : 'hover:bg-muted/60',
                    )}
                  >
                    <Checkbox
                      checked={visible[structure.id] ?? false}
                      onCheckedChange={(checked) =>
                        setVisible((current) => ({ ...current, [structure.id]: checked === true }))
                      }
                      aria-label={`Show ${structure.name}`}
                    />
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                      style={{ background: swatch(structure.color) }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => select(structure.id)}
                    >
                      {structure.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </nav>
    </div>
  )
}

class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          The 3D model did not load. Reload the page to try again; it needs a browser with WebGL.
        </div>
      )
    }
    return this.props.children
  }
}
