'use client'

import dynamic from 'next/dynamic'

import type { AirwayAnatomyEmbedOptions } from './AirwayAnatomyModule'

const AirwayAnatomyModule = dynamic(
  () => import('./AirwayAnatomyModule').then((module) => module.AirwayAnatomyModule),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[680px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading airway anatomy module...
      </div>
    ),
  },
)

// The case source is resolved inside the client bundle; a server page cannot pass it as a prop.
const DolphinAirwayModule = dynamic(
  () =>
    import('./AirwayAnatomyModule').then(({ AirwayAnatomyModule, DOLPHIN_AIRWAY_CASE }) => {
      function DolphinAirway() {
        return <AirwayAnatomyModule source={DOLPHIN_AIRWAY_CASE} />
      }
      return DolphinAirway
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[680px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading dolphin airway...
      </div>
    ),
  },
)

/**
 * The dolphin case inside a lesson: the same module with the embed options a lesson sets (start,
 * labels, chrome, location callbacks). Without `embed` it is the standalone dolphin page.
 */
const DolphinAirwayEmbed = dynamic(
  () =>
    import('./AirwayAnatomyModule').then(({ AirwayAnatomyModule, DOLPHIN_AIRWAY_CASE }) => {
      function DolphinAirwayEmbedded({ embed }: { embed: AirwayAnatomyEmbedOptions }) {
        return <AirwayAnatomyModule source={DOLPHIN_AIRWAY_CASE} embed={embed} />
      }
      return DolphinAirwayEmbedded
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-border/70 bg-card/70 text-sm text-muted-foreground">
        Loading the dolphin airway…
      </div>
    ),
  },
)

export function AirwayAnatomyModuleDynamic() {
  return <AirwayAnatomyModule />
}

export function DolphinAirwayModuleDynamic() {
  return <DolphinAirwayModule />
}

export function DolphinAirwayEmbedDynamic({ embed }: { embed: AirwayAnatomyEmbedOptions }) {
  return <DolphinAirwayEmbed embed={embed} />
}
