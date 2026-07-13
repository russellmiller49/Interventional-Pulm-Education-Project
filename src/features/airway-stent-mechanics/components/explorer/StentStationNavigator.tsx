'use client'

import { cn } from '@/lib/cn'

import type { StentExplorerStation, StentExplorerStationId } from '../../explorer/types'

interface StentStationNavigatorProps {
  activeStationId: StentExplorerStationId
  onSelect: (stationId: StentExplorerStationId) => void
  stations: readonly StentExplorerStation[]
}

const categoryLabels: Record<StentExplorerStation['category'], string> = {
  foundation: 'Foundation',
  failure: 'Failure atlas',
  carina: 'Carina',
  procedure: 'Procedure',
}

export function StentStationNavigator({
  activeStationId,
  onSelect,
  stations,
}: StentStationNavigatorProps) {
  return (
    <nav
      className="rounded-2xl border border-slate-700/80 bg-slate-950 p-3 text-white shadow-xl"
      aria-label="Airway stent clinical questions"
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Clinical questions
          </p>
          <p className="text-xs text-slate-400">Choose any of the eleven questions.</p>
        </div>
        <p className="hidden text-[10px] text-slate-500 sm:block">Scroll questions horizontally</p>
      </div>

      <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-color:rgb(71_85_105)_transparent] [scrollbar-width:thin]">
        {stations.map((station) => {
          const active = station.id === activeStationId
          return (
            <button
              key={station.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(station.id)}
              title={station.summary}
              className={cn(
                'flex min-h-14 min-w-[10.5rem] snap-start items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 motion-reduce:transition-none',
                active
                  ? 'border-cyan-300/70 bg-cyan-300/12 text-white'
                  : 'border-slate-800 bg-slate-900/55 text-slate-300 hover:border-slate-600 hover:bg-slate-900',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  active ? 'bg-cyan-300 text-slate-950' : 'bg-slate-800 text-slate-300',
                )}
              >
                {station.number}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-5">
                  {station.shortLabel}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                  {categoryLabels[station.category]}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
