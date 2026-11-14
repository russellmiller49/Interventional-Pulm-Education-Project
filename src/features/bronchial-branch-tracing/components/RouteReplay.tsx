import { replayLine } from '../content/bench-copy'
import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import type { ReplayRow } from '../engine/route-replay'
import { TREE_BOX, TREE_BRANCHES, treePath, treePoint } from '../geometry/airway-tree'
import { astrayPath } from '../geometry/astray'
import { pairedPath } from '../geometry/paired-scope'
import { arrivalArc } from '../geometry/route-stations'
import styles from './nav-bench.module.css'

/**
 * The drive read back at arrival: the whole route on the airway tree, a dashed stub for each
 * branch that led away and was driven into, and one line per fork where the learner chose. It is
 * shown only once the scope has arrived, so the route and the lesion give nothing away.
 */
export function RouteReplay({
  trace,
  target,
  rows,
}: {
  trace: CtTrace
  target: CtNoduleTarget
  rows: readonly ReplayRow[]
}) {
  const { points, arcs } = pairedPath(trace)
  const end = arrivalArc(trace)
  const route = treePath(points.filter((_, i) => arcs[i] <= end))
  const stubs = rows.flatMap((row) =>
    row.away.flatMap((option) => {
      const path = astrayPath(trace, row.checkpointIndex, option)
      if (!path) return []
      const beyond = path.points.filter((_, i) => path.arcs[i] >= path.forkArc - 1e-6)
      return [{ key: `${row.station}:${option}`, d: treePath(beyond) }]
    }),
  )
  const [lx, ly] = treePoint(target.centerLps)
  const { x, y, width, height } = TREE_BOX
  return (
    <div className={styles.replay} data-route-replay>
      <svg
        className={styles.replayTree}
        viewBox={`${x} ${y} ${width} ${height}`}
        role="img"
        aria-label={`The airway tree seen from the front, with the route driven to the lesion${
          stubs.length
            ? ` and ${stubs.length} ${stubs.length === 1 ? 'branch' : 'branches'} that led away`
            : ''
        }.`}
      >
        {TREE_BRANCHES.map((branch) => (
          <path
            key={branch.id}
            d={branch.d}
            className={styles.treeBranch}
            strokeWidth={Math.max(1, Math.min(4, branch.radiusMm * 0.6))}
          />
        ))}
        <path d={route} className={styles.treeRoute} data-replay-route />
        {stubs.map((stub) => (
          <path key={stub.key} d={stub.d} className={styles.replayStub} data-replay-stub />
        ))}
        <circle cx={lx} cy={ly} r="7" className={styles.replayLesion} />
      </svg>
      <ol className={styles.replayRows}>
        {rows.map((row) => (
          <li key={row.station} data-replay-row={row.result}>
            <span aria-hidden="true" data-replay-mark>
              {row.result === 'first' ? '✓' : row.result === 'later' ? '↩' : '→'}
            </span>
            {replayLine(row, trace.checkpoints[row.checkpointIndex].decision!.parent.airway.code)}
          </li>
        ))}
      </ol>
    </div>
  )
}
