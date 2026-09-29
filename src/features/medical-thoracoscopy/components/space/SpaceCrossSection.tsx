import { pleuralZone } from '../../content/pleuralZones'
import styles from './space-pane.module.css'
import { ledgerWords, VIEW_WORDS } from './spaceWords'
import { spaceControlId, type CrossSection, type PlanePoint, type ZoneLedger } from './types'

const PAD_MM = 12

/**
 * The Chest view without 3D: the cut through the space along the telescope that the engine
 * computed, the wall drawn run by run in its zone's ledger state (line style as well as colour, so
 * colour is never the only cue), the lung, the telescope from the port to its tip and the field of
 * view; where the scenario has them, the teaching target and the forceps out beyond the tip. Every
 * run carries its zone and estimate in words for assistive technology.
 */
export function SpaceCrossSection({
  section,
  ledger,
}: {
  readonly section: CrossSection
  readonly ledger: ZoneLedger
}) {
  const all: PlanePoint[] = [
    ...section.wall.flatMap((run) => run.points),
    ...section.lung.flat(),
    section.port,
    section.tip,
    ...section.field,
    ...(section.target ?? []).flat(),
    ...(section.tool ? [section.tool.tip] : []),
  ]
  const xs = all.map((point) => point[0])
  const ys = all.map((point) => point[1])
  const left = Math.min(...xs) - PAD_MM
  const top = Math.max(...ys) + PAD_MM
  const width = Math.max(...xs) - Math.min(...xs) + 2 * PAD_MM
  const height = Math.max(...ys) - Math.min(...ys) + 2 * PAD_MM
  const at = (point: PlanePoint) => `${(point[0] - left).toFixed(2)},${(top - point[1]).toFixed(2)}`
  const path = (points: readonly PlanePoint[]) => points.map(at).join(' ')
  const titleId = spaceControlId('cross-section-title')
  const descId = spaceControlId('cross-section-desc')
  return (
    <svg
      className={styles.crossSection}
      viewBox={`0 0 ${width.toFixed(2)} ${height.toFixed(2)}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>{VIEW_WORDS.chestHeading}</title>
      <desc id={descId}>{`${VIEW_WORDS.chestNote} ${section.seenFrom}`}</desc>
      <polygon
        className={styles.field}
        points={path([section.tip, section.field[0], section.field[1]])}
        data-part="field"
      >
        <title>{VIEW_WORDS.field}</title>
      </polygon>
      {section.lung.map((outline, index) => (
        <polygon key={index} className={styles.lung} points={path(outline)} data-part="lung">
          <title>{VIEW_WORDS.lung}</title>
        </polygon>
      ))}
      {section.wall.map((run, index) => {
        const entry = ledger.find((item) => item.zone === run.zone)
        return (
          <polyline
            key={`${run.zone}-${index}`}
            className={styles.wall}
            points={path(run.points)}
            data-zone={run.zone}
            data-seen={entry?.seen}
          >
            <title>{`${pleuralZone(run.zone).name}: ${entry ? ledgerWords(entry) : ''}`}</title>
          </polyline>
        )
      })}
      {(section.target ?? []).map((outline, index) => (
        <polygon key={index} className={styles.target} points={path(outline)} data-part="target">
          <title>{VIEW_WORDS.nodule}</title>
        </polygon>
      ))}
      {section.tool ? (
        <g data-part="forceps">
          <line
            className={styles.forcepsShaft}
            x1={section.tool.exit[0] - left}
            y1={top - section.tool.exit[1]}
            x2={section.tool.jawBase[0] - left}
            y2={top - section.tool.jawBase[1]}
          >
            <title>{VIEW_WORDS.forcepsShaft}</title>
          </line>
          <line
            className={styles.forcepsJaws}
            x1={section.tool.jawBase[0] - left}
            y1={top - section.tool.jawBase[1]}
            x2={section.tool.tip[0] - left}
            y2={top - section.tool.tip[1]}
            data-part="jaws"
          >
            <title>{VIEW_WORDS.forcepsJaws}</title>
          </line>
        </g>
      ) : null}
      <line
        className={styles.telescope}
        x1={section.port[0] - left}
        y1={top - section.port[1]}
        x2={section.tip[0] - left}
        y2={top - section.tip[1]}
        data-part="telescope"
      >
        <title>{VIEW_WORDS.telescope}</title>
      </line>
      <circle
        className={styles.port}
        cx={section.port[0] - left}
        cy={top - section.port[1]}
        r={3}
        data-part="port"
      >
        <title>{VIEW_WORDS.port}</title>
      </circle>
    </svg>
  )
}
