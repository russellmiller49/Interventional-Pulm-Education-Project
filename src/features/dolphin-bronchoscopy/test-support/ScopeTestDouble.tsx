'use client'

import type { AirwayAnatomyEmbedOptions } from '@/components/airway-anatomy/AirwayAnatomyModule'
import type { AirwayScopeLocation } from '@/lib/airway-anatomy/scope-location'

/**
 * A DOM-only stand-in for the dolphin airway in stage tests: no WebGL, no fetch. It prints what the
 * embed asked for and offers one button per place, each of which reports a location exactly as the
 * real module does on a change of edge.
 *
 * Tests mock `@/components/airway-anatomy/AirwayAnatomyModuleDynamic` with this.
 */
export const SCOPE_DOUBLE_PLACES = [
  'LNP',
  'NPX',
  'NPF',
  'LS',
  'LX',
  'TRA',
  'RTB',
  'RMB',
  'LMB',
  'RB1',
  'LB1',
] as const

export function ScopeTestDouble({ embed }: { readonly embed: AirwayAnatomyEmbedOptions }) {
  const location = (abbr: string): AirwayScopeLocation => ({
    edgeId: SCOPE_DOUBLE_PLACES.indexOf(abbr as (typeof SCOPE_DOUBLE_PLACES)[number]),
    abbr,
    name: abbr,
    distanceMm: 0,
    edgeLengthMm: 10,
    freeDrive: false,
    pathAbbrs: [abbr],
  })
  return (
    <div
      data-scope-double
      data-start-edge={embed.start?.edgeId}
      data-start-key={embed.start?.key}
      data-branch-labels={embed.branchLabels}
      data-show-location={String(embed.showLocation ?? true)}
      data-ct={String(embed.chrome?.ct ?? true)}
      data-target={embed.target?.abbr ?? ''}
    >
      {SCOPE_DOUBLE_PLACES.map((abbr) => (
        <button key={abbr} type="button" onClick={() => embed.onLocationChange?.(location(abbr))}>
          Drive to {abbr}
        </button>
      ))}
    </div>
  )
}

export const scopeDoubleModule = {
  DolphinAirwayEmbedDynamic: ScopeTestDouble,
  DolphinAirwayModuleDynamic: () => null,
  AirwayAnatomyModuleDynamic: () => null,
}
