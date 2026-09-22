'use client'

import { useId } from 'react'

import {
  RECONSTRUCTION_ACCOUNTS,
  RECONSTRUCTION_CONTRAST,
  type ReconstructionAccount,
} from '../../content/reconstruction'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import { imagingLesson, peripheralImagingSectionIds } from '../../content/pathway'
import { Link } from '@/i18n/navigation'
import styles from './imaging-stage.module.css'

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/)
  return (match ? match[0] : text).trim()
}

const LEAD_ROWS: readonly {
  readonly label: string
  readonly cell: (a: ReconstructionAccount) => string
}[] = [
  { label: 'In short', cell: (a) => a.inShort },
  { label: 'What is collected', cell: (a) => firstSentence(a.measured) },
  { label: 'What comes out', cell: (a) => firstSentence(a.comesOut) },
  { label: 'How much of it was acquired', cell: (a) => firstSentence(a.provenance) },
  { label: 'Its visible limit', cell: (a) => firstSentence(a.cannotAsk[0]) },
]

/**
 * Reports 4.1 and 5.1: on the demonstration step the analogy comes first, then one readable figure
 * per modality, then a short table; the full two-column account, with what each answers and does
 * not and its model boundary, is one disclosure away. A section that builds one of the two leads
 * with that one and says where the other is taught, rather than repeating every paragraph.
 */
function LeadComparison({ lead }: { readonly lead: ReconstructionAccount['id'] | 'both' }) {
  const ordered = [...RECONSTRUCTION_ACCOUNTS].sort((a, b) =>
    a.id === lead ? -1 : b.id === lead ? 1 : 0,
  )
  const emphasised = lead === 'both' ? null : ordered[0]
  const other = lead === 'both' ? null : ordered[1]
  return (
    <div className={styles.reconstruction} data-reconstruction-comparison data-lead={lead}>
      <p className={styles.reconstructionAnalogy} data-reconstruction-analogy>
        <strong>Think of it this way.</strong> {(emphasised ?? ordered[0]).analogy}
      </p>
      <div className={styles.reconstructionPair}>
        {ordered.map((account) => (
          <figure
            key={account.id}
            className={styles.reconstructionFigure}
            data-reconstruction-figure={account.id}
            data-emphasis={account.id === lead ? 'true' : undefined}
          >
            <figcaption>
              <strong>{account.name}.</strong> {account.inShort}
            </figcaption>
            <ReconstructionDiagram account={account.id} />
            <ul className={styles.reconstructionLegend} aria-label="Legend">
              {account.id === 'tomosynthesis' ? (
                <>
                  <li>Shaded band: acquired, across the image.</li>
                  <li>Dashed block: inferred along the beam, from an older scan or a model.</li>
                </>
              ) : (
                <>
                  <li>Gridded block: acquired, in every direction.</li>
                  <li>Block edge: where the volume is truncated.</li>
                </>
              )}
            </ul>
          </figure>
        ))}
      </div>
      <table className={styles.reconstructionTable} data-reconstruction-table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Aspect</span>
            </th>
            {ordered.map((account) => (
              <th
                key={account.id}
                scope="col"
                data-emphasis={account.id === lead ? 'true' : undefined}
              >
                {account.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEAD_ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {ordered.map((account) => (
                <td key={account.id} data-emphasis={account.id === lead ? 'true' : undefined}>
                  {row.cell(account)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {other ? (
        <p className={styles.reconstructionWhere} data-reconstruction-elsewhere={other.id}>
          The {other.name} side is taught in{' '}
          <Link href={imagingSectionLinkTarget(other.shownIn)}>
            Section {peripheralImagingSectionIds.indexOf(other.shownIn) + 1},{' '}
            {imagingLesson(other.shownIn).title}
          </Link>
          ; it is kept here for the comparison.
        </p>
      ) : null}
      <details className={styles.reconstructionFull} data-reconstruction-full>
        <summary>
          Full account: how each picture is built, what it answers and what it does not, and its
          model boundary
        </summary>
        <p className={styles.reconstructionLede}>{RECONSTRUCTION_CONTRAST}</p>
        <div className={styles.reconstructionPair}>
          {ordered.map((account) => (
            <AccountCard key={account.id} account={account} dense={false} />
          ))}
        </div>
      </details>
    </div>
  )
}

/**
 * How a reconstruction is made: the two acquisitions side by side.
 *
 * The drawing carries the mechanism — a narrow span of directions against a wide orbit, and how
 * much of the result each one actually measured — and the prose carries what the result may be
 * asked. Both are drawn from one authored account, so the comparison reads the same wherever it
 * appears.
 *
 * The two right-hand panels are deliberately the same shape. A limited sweep on the platforms in
 * use is commonly rendered as a set the operator cuts in any plane, exactly as an orbit is, so a
 * drawing that gave them different shapes would teach the wrong difference. What differs is which
 * part of that shape was measured.
 */
export function ReconstructionComparison({
  dense = false,
  lead,
}: {
  readonly dense?: boolean
  /** Lead with the analogy, figures and a short table; the full account folds (reports 4.1, 5.1). */
  readonly lead?: ReconstructionAccount['id'] | 'both'
}) {
  if (lead) return <LeadComparison lead={lead} />
  return (
    <div
      className={styles.reconstruction}
      data-reconstruction-comparison
      data-dense={dense || undefined}
    >
      <p className={styles.reconstructionLede}>{RECONSTRUCTION_CONTRAST}</p>
      <div className={styles.reconstructionPair}>
        {RECONSTRUCTION_ACCOUNTS.map((account) => (
          <AccountCard key={account.id} account={account} dense={dense} />
        ))}
      </div>
    </div>
  )
}

function AccountCard({
  account,
  dense,
}: {
  readonly account: ReconstructionAccount
  readonly dense: boolean
}) {
  const lesson = imagingLesson(account.shownIn)
  return (
    <section className={styles.reconstructionCard} data-reconstruction={account.id}>
      <p className={styles.kicker}>{account.name}</p>
      <p className={styles.reconstructionShort}>{account.inShort}</p>
      <ReconstructionDiagram account={account.id} />
      <dl className={styles.reconstructionFacts}>
        <dt>What is collected</dt>
        <dd>{account.measured}</dd>
        <dt>How the picture is built</dt>
        <dd>
          <ol className={styles.reconstructionSteps}>
            {account.built.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </dd>
        <dt>What comes out</dt>
        <dd>{account.comesOut}</dd>
        <dt>How much of it was acquired</dt>
        <dd>{account.provenance}</dd>
      </dl>
      {dense ? null : (
        <div className={styles.reconstructionAsk}>
          <div>
            <p className={styles.kicker}>What it answers</p>
            <ul>
              {account.canAsk.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className={styles.kicker}>What it does not</p>
            <ul>
              {account.cannotAsk.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className={styles.reconstructionBoundary}>
        <strong>Model boundary.</strong> {account.boundary}
      </p>
      <p className={styles.reconstructionWhere}>
        Watch it being built in{' '}
        <Link href={imagingSectionLinkTarget(account.shownIn)}>{lesson.title}</Link>.
      </p>
    </section>
  )
}

/**
 * The mechanism in one picture: where the source went, and how much of what came back was measured.
 *
 * Deliberately schematic. The geometry the module draws to scale lives in the suite; this says only
 * that a narrow span of directions and a full orbit can hand back the same shape, and that the two
 * shapes are not filled the same way. Both right-hand panels are therefore the same block: the
 * orbit's is measured throughout and stops at its edge, the sweep's is measured across and supplied
 * along the beam.
 */
/** Server and client must print identical coordinates, or hydration reports a mismatch. */
const round2 = (value: number) => Math.round(value * 100) / 100

export function ReconstructionDiagram({
  account,
}: {
  readonly account: ReconstructionAccount['id']
}) {
  const base = useId()
  const titleId = `${base}-title`
  const limited = account === 'tomosynthesis'
  const label = limited
    ? 'A limited arc of source positions on one side of the patient, and the volume it returns: acquired across the image, and inferred along the beam from an older scan or a model.'
    : 'Source positions all the way around the patient, and the volume the CBCT spin returns: acquired in every direction, and truncated at the edge of the reconstruction volume.'

  // Source positions: a narrow fan above, or a full ring.
  const marks = limited
    ? Array.from({ length: 7 }, (_, i) => {
        const angle = (-30 + (i * 60) / 6) * (Math.PI / 180)
        return [round2(72 + Math.sin(angle) * 52), round2(74 - Math.cos(angle) * 52)] as const
      })
    : Array.from({ length: 16 }, (_, i) => {
        const angle = (i * 2 * Math.PI) / 16
        return [round2(72 + Math.sin(angle) * 52), round2(74 - Math.cos(angle) * 52)] as const
      })

  // The returned block, shared by both so the drawing never implies different output shapes.
  const box = { x: 196, y: 38, width: 86, height: 66 } as const
  const measuredBand = { y: 60, height: 22 } as const
  // The legend runs the width of the panel, so it starts left of the block rather than under it.
  const legendX = 168

  return (
    <svg
      className={styles.reconstructionDiagram}
      viewBox="0 0 300 150"
      role="img"
      aria-labelledby={titleId}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id={titleId}>{label}</title>

      {/* left: where the source went */}
      {marks.map(([x, y], index) => (
        <line
          key={`ray-${index}`}
          x1={x}
          y1={y}
          x2={72}
          y2={74}
          stroke="currentColor"
          strokeOpacity={0.28}
          strokeWidth={1}
        />
      ))}
      {marks.map(([x, y], index) => (
        <circle key={`src-${index}`} cx={x} cy={y} r={3.2} fill="var(--amber, #ffbf62)" />
      ))}
      {/* the patient in the middle */}
      <ellipse cx={72} cy={74} rx={17} ry={12} fill="currentColor" fillOpacity={0.22} />
      <circle cx={72} cy={74} r={3.4} fill="var(--cyan-bright, #71e1e5)" />

      {/* the arrow across */}
      <line
        x1={152}
        y1={71}
        x2={176}
        y2={71}
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1.4}
      />
      <path d="M176 71 l-6 -3.6 v7.2 z" fill="currentColor" fillOpacity={0.5} />

      {/* right: the block that comes back, and how much of it was measured */}
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx={3}
        fill="currentColor"
        fillOpacity={limited ? 0.08 : 0.18}
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={1}
        strokeDasharray={limited ? '3 2.5' : undefined}
      />
      {limited ? (
        <rect
          x={box.x}
          y={measuredBand.y}
          width={box.width}
          height={measuredBand.height}
          fill="currentColor"
          fillOpacity={0.3}
        />
      ) : null}
      {/* The orbit's block is gridded throughout: every direction in it was measured. The sweep's
          is left empty outside the band, so the two-tone fill is the only cue in that panel. */}
      {limited
        ? null
        : [0, 1, 2, 3].map((i) => (
            <line
              key={`v-${i}`}
              x1={box.x + 17.2 * (i + 1)}
              y1={box.y}
              x2={box.x + 17.2 * (i + 1)}
              y2={box.y + box.height}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
          ))}
      {limited
        ? null
        : [0, 1, 2].map((i) => (
            <line
              key={`h-${i}`}
              x1={box.x}
              y1={box.y + 16.5 * (i + 1)}
              x2={box.x + box.width}
              y2={box.y + 16.5 * (i + 1)}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
          ))}
      <circle cx={239} cy={71} r={4} fill="var(--cyan-bright, #71e1e5)" />

      {/* the legend: the whole point of the pair */}
      <g fontSize={7.2} fill="currentColor" fillOpacity={0.78}>
        <rect
          x={legendX}
          y={116}
          width={11}
          height={7}
          fill="currentColor"
          fillOpacity={limited ? 0.3 : 0.18}
        />
        <text x={legendX + 15} y={122.4}>
          {limited ? 'acquired, across the image' : 'acquired, every direction'}
        </text>
        <rect
          x={legendX}
          y={129}
          width={11}
          height={7}
          fill="currentColor"
          fillOpacity={0.08}
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeWidth={0.8}
          strokeDasharray={limited ? '3 2.5' : undefined}
        />
        <text x={legendX + 15} y={135.4}>
          {limited ? 'inferred, along the beam' : 'truncated at this edge'}
        </text>
      </g>
    </svg>
  )
}
