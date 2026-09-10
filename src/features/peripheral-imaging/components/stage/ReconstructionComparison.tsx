'use client'

import { useId } from 'react'

import {
  RECONSTRUCTION_ACCOUNTS,
  RECONSTRUCTION_CONTRAST,
  type ReconstructionAccount,
} from '../../content/reconstruction'
import { imagingSectionLinkTarget } from '../../content/pathwayResolver'
import { imagingLesson } from '../../content/pathway'
import { Link } from '@/i18n/navigation'
import styles from './imaging-stage.module.css'

/**
 * How a reconstruction is made: the two acquisitions side by side.
 *
 * The drawing carries the mechanism — a narrow span of directions against a wide orbit, and the
 * shape of what each returns — and the prose carries what the result may be asked. Both are drawn
 * from one authored account, so the comparison reads the same wherever it appears.
 */
export function ReconstructionComparison({ dense = false }: { readonly dense?: boolean }) {
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
 * The mechanism in one picture: where the source went, and the shape of what came back.
 *
 * Deliberately schematic. The geometry the module draws to scale lives in the suite; this says
 * only that a narrow span returns planes and a wide orbit returns a block.
 */
export function ReconstructionDiagram({
  account,
}: {
  readonly account: ReconstructionAccount['id']
}) {
  const base = useId()
  const titleId = `${base}-title`
  const limited = account === 'tomosynthesis'
  const label = limited
    ? 'A short arc of source positions on one side of the patient, and the stack of pictures it returns, one sharp at each depth.'
    : 'Source positions all the way around the patient, and the block of tissue the orbit returns, which can be cut in any plane.'

  // Source positions: a narrow fan above, or a full ring.
  const marks = limited
    ? Array.from({ length: 7 }, (_, i) => {
        const angle = (-24 + (i * 48) / 6) * (Math.PI / 180)
        return [72 + Math.sin(angle) * 52, 74 - Math.cos(angle) * 52] as const
      })
    : Array.from({ length: 16 }, (_, i) => {
        const angle = (i * 2 * Math.PI) / 16
        return [72 + Math.sin(angle) * 52, 74 - Math.cos(angle) * 52] as const
      })

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
        y1={74}
        x2={176}
        y2={74}
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1.4}
      />
      <path d="M176 74 l-6 -3.6 v7.2 z" fill="currentColor" fillOpacity={0.5} />

      {/* right: the shape of the result */}
      {limited ? (
        <g>
          {[0, 1, 2, 3, 4].map((row) => {
            const y = 40 + row * 17
            const sharp = row === 2
            return (
              <g key={row}>
                <rect
                  x={196}
                  y={y}
                  width={86}
                  height={11}
                  rx={2}
                  fill="currentColor"
                  fillOpacity={sharp ? 0.34 : 0.12}
                />
                <circle
                  cx={239}
                  cy={y + 5.5}
                  r={sharp ? 3.4 : 5.4}
                  fill="var(--cyan-bright, #71e1e5)"
                  fillOpacity={sharp ? 1 : 0.28}
                />
              </g>
            )
          })}
        </g>
      ) : (
        <g>
          <rect
            x={196}
            y={40}
            width={86}
            height={69}
            rx={3}
            fill="currentColor"
            fillOpacity={0.18}
          />
          {[0, 1, 2, 3].map((i) => (
            <line
              key={`v-${i}`}
              x1={196 + 17.2 * (i + 1)}
              y1={40}
              x2={196 + 17.2 * (i + 1)}
              y2={109}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <line
              key={`h-${i}`}
              x1={196}
              y1={40 + 17.25 * (i + 1)}
              x2={282}
              y2={40 + 17.25 * (i + 1)}
              stroke="currentColor"
              strokeOpacity={0.25}
            />
          ))}
          <circle cx={239} cy={74} r={4} fill="var(--cyan-bright, #71e1e5)" />
        </g>
      )}
    </svg>
  )
}
