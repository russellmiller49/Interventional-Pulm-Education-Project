import type { CtTrace } from '../content/ct-types'
import { TREE_BOX, TREE_BRANCHES, routeSoFar, treePoint } from '../geometry/airway-tree'
import type { Vec3 } from '../geometry/coordinates'
import styles from './nav-bench.module.css'

/**
 * Where the scope is, on the whole tree: a small frontal picture in the corner of the scope pane,
 * with the stretch of route already covered and the tip. It never shows the route ahead, the
 * lesion or a name: it answers "which lobe am I in", not "which way next".
 */
export function AirwayTreeInset({
  trace,
  position,
  where,
}: {
  trace: CtTrace
  /** The scope tip, patient space. */
  position: Vec3
  /** The airway the scope is in, for the picture's accessible name. */
  where: string
}) {
  const soFar = routeSoFar(trace, position)
  const [x, y] = treePoint(position)
  const { x: bx, y: by, width, height } = TREE_BOX
  return (
    <figure
      className={styles.treeInset}
      style={{ aspectRatio: `${width} / ${height}` }}
      data-tree-inset
      data-tree-arc={soFar.arc.toFixed(1)}
    >
      <svg
        viewBox={`${bx} ${by} ${width} ${height}`}
        role="img"
        aria-label={`The airway tree seen from the front, with the scope tip in ${where}.`}
      >
        {TREE_BRANCHES.map((branch) => (
          <path
            key={branch.id}
            d={branch.d}
            className={styles.treeBranch}
            // A wider airway is a heavier line; the finest still shows.
            strokeWidth={Math.max(1, Math.min(4, branch.radiusMm * 0.6))}
          />
        ))}
        <path d={soFar.d} className={styles.treeRoute} data-tree-route />
        <circle cx={x} cy={y} r="9" className={styles.treeTipHalo} />
        <circle cx={x} cy={y} r="5" className={styles.treeTip} data-tree-tip />
        <text x={bx + 6} y={by + 20} className={styles.treeSide}>
          R
        </text>
        <text x={bx + width - 6} y={by + 20} className={styles.treeSide} textAnchor="end">
          L
        </text>
      </svg>
    </figure>
  )
}
