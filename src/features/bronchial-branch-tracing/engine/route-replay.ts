import type { NavPlan, NavSession } from './nav-session'

/**
 * The drive, read back at arrival: at each fork where the learner chose, whether the opening
 * toward the lesion was their first choice, and which openings they drove into first.
 */
export interface ReplayRow {
  station: number
  checkpointIndex: number
  /** Which division of the map this fork is, 0 first; null above the segmental ostium. */
  division: number | null
  /** The opening toward the lesion: the first choice, a later one, or shown by the bench. */
  result: 'first' | 'later' | 'shown'
  /** Openings driven into that led away, in the order entered. */
  away: number[]
  /** Other openings chosen that lead away, refused at the fork without a drive. */
  refused: number
}

export function replayRows(
  plan: NavPlan,
  session: NavSession,
  mapForks: readonly number[] = [],
): ReplayRow[] {
  return session.log.flatMap((entry, station) => {
    const planned = plan.stations[station]
    if (!entry.chooseAsked || !planned) return []
    // The fork the scope stands at has no answer yet unless the trip is over.
    if (station === session.station && session.phase !== 'arrived' && session.phase !== 'done')
      return []
    const division = mapForks.indexOf(planned.checkpointIndex)
    return [
      {
        station,
        checkpointIndex: planned.checkpointIndex,
        division: division < 0 ? null : division,
        result: entry.chooseShown ? 'shown' : entry.chooseMisses ? 'later' : 'first',
        away: [...(entry.away ?? [])],
        refused: Math.max(0, entry.chooseMisses - entry.wrongTurns),
      } satisfies ReplayRow,
    ]
  })
}

/** The mark a division carries on the map at arrival, by map division; null where none chose. */
export function replayMarks(rows: readonly ReplayRow[], divisions: number) {
  return Array.from({ length: divisions }, (_, division) => {
    const row = rows.find((r) => r.division === division)
    return row ? row.result : null
  })
}
