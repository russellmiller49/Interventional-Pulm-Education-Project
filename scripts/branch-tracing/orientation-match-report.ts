/**
 * Which CT display matches the scope at every division of every route, beside the book's regional
 * display for that route.
 *
 *   npx tsx scripts/branch-tracing/orientation-match-report.ts            # one row per station
 *   npx tsx scripts/branch-tracing/orientation-match-report.ts --summary  # counts only
 *
 * Read-only. `__tests__/orientation-match.test.ts` pins the summary.
 */
import { stationMatch } from '../../src/features/bronchial-branch-tracing/engine/orientation-match'
import { CT_TRACES } from '../../src/features/bronchial-branch-tracing/geometry/native-ct'
import { orientationName } from '../../src/features/bronchial-branch-tracing/geometry/orientation'

let stations = 0,
  bookMatches = 0,
  twoWay = 0
const rows: string[] = []
for (const trace of CT_TRACES)
  trace.checkpoints.forEach((checkpoint, index) => {
    const match = stationMatch(trace, index)
    if (!match || !checkpoint.decision) return
    stations++
    if (match.bookAccepted) bookMatches++
    if (match.accepted.length > 1) twoWay++
    rows.push(
      [
        trace.id.padEnd(22),
        checkpoint.id.padEnd(13),
        checkpoint.decision.parent.airway.code.padEnd(13),
        `match: ${match.accepted.map(orientationName).join(' | ')}`.padEnd(64),
        `book: ${orientationName(match.book)}${match.bookAccepted ? '' : '  (differs)'}`.padEnd(46),
        match.weakAxis ? `looks along ${match.weakAxis}` : '',
      ].join(' '),
    )
  })
if (!process.argv.includes('--summary')) console.log(rows.join('\n'))
console.log(
  `${stations} stations: the book's regional display matches at ${bookMatches}, differs at ${stations - bookMatches}; ${twoWay} accept more than one display.`,
)
