import styles from './figures.module.css'

/**
 * The course's opening figure: one peripheral airway, drawn once, with the four kinds of evidence
 * added to it one at a time — the navigation target from the planning CT, the lesion on current
 * imaging, the biopsy tool with its sampling component, and the specimen.
 *
 * Owner feedback, 2026-10-11 (slide 2): the figure this replaces was a 200-unit sketch of three
 * straight lines scaled to the width of the page. This one is drawn at the size it is shown, with
 * tapered airways, a catheter that follows them, and labels on the drawing itself.
 */
export type EvidenceStep = 0 | 1 | 2 | 3

const VIEW = { width: 720, height: 372 } as const

/** Airways, widest first: the path of each centre line and the outer width of its wall. */
const AIRWAYS: readonly { readonly d: string; readonly width: number }[] = [
  { d: 'M-30 -22 C80 44 180 96 250 150', width: 34 },
  { d: 'M250 150 C320 175 380 205 432 236', width: 25 },
  { d: 'M250 150 C272 200 244 262 176 312', width: 23 },
  { d: 'M432 236 C465 252 500 268 536 286', width: 15 },
  { d: 'M432 236 C452 272 458 312 470 356', width: 13 },
  { d: 'M340 187 C372 152 392 122 398 86', width: 11 },
  { d: 'M176 312 C140 326 104 340 60 348', width: 13 },
  { d: 'M176 312 C186 336 204 356 232 390', width: 12 },
]

/** The catheter follows the airway to the target. */
const CATHETER = 'M-30 -22 C80 44 180 96 250 150 C320 175 380 205 432 236 C465 252 498 267 528 282'
const CATHETER_TIP = { x: 528, y: 282 } as const
const TARGET = { x: 556, y: 296, r: 26 } as const
const LESION = { x: 604, y: 246, r: 25 } as const

/** A nodule outline: a circle with an uneven margin, fixed numbers so server and client agree. */
const LESION_OUTLINE = (() => {
  const radii = [25, 27.5, 23, 26.5, 24, 28, 23.5, 25.5, 27, 23.5, 26, 24]
  const points = radii.map((radius, index) => {
    const angle = (index / radii.length) * Math.PI * 2
    return [
      Number((LESION.x + Math.cos(angle) * radius).toFixed(1)),
      Number((LESION.y + Math.sin(angle) * radius).toFixed(1)),
    ] as const
  })
  const mid = (a: readonly [number, number], b: readonly [number, number]) =>
    [Number(((a[0] + b[0]) / 2).toFixed(1)), Number(((a[1] + b[1]) / 2).toFixed(1))] as const
  const start = mid(points[points.length - 1], points[0])
  const curves = points.map((point, index) => {
    const next = mid(point, points[(index + 1) % points.length])
    return `Q${point[0]} ${point[1]} ${next[0]} ${next[1]}`
  })
  return `M${start[0]} ${start[1]} ${curves.join(' ')}Z`
})()

/** The biopsy tool: out of the catheter, through the lesion, its tip a little past the centre. */
const TOOL = (() => {
  const dx = LESION.x - CATHETER_TIP.x
  const dy = LESION.y - CATHETER_TIP.y
  const length = Math.hypot(dx, dy)
  const ux = dx / length
  const uy = dy / length
  const at = (distance: number) =>
    [
      Number((CATHETER_TIP.x + ux * distance).toFixed(1)),
      Number((CATHETER_TIP.y + uy * distance).toFixed(1)),
    ] as const
  const tip = at(length + 10)
  return { tip, windowFrom: at(length - 13), windowTo: at(length + 3) }
})()

export const EVIDENCE_STEP_ALT: readonly string[] = [
  'A catheter follows a peripheral airway to a dashed circle: the navigation target from the planning CT.',
  'The same airway. The lesion on current imaging lies beside the dashed navigation target, not on it.',
  'The same airway. A biopsy tool leaves the catheter and crosses the lesion; its tip and its sampling component are labelled.',
  'The same airway and tool. The specimen is a separate result, still pending.',
]

export function EvidenceSequenceFigure({ step }: { readonly step: EvidenceStep }) {
  const showLesion = step >= 1
  const showTool = step >= 2
  const showSpecimen = step === 3
  return (
    <svg
      className={styles.evidenceFigure}
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label={EVIDENCE_STEP_ALT[step]}
      data-evidence-figure={step}
    >
      <defs>
        <radialGradient id="evidence-parenchyma" cx="52%" cy="48%" r="72%">
          <stop offset="0" stopColor="#1d4350" />
          <stop offset="0.6" stopColor="#153541" />
          <stop offset="1" stopColor="#0e2630" />
        </radialGradient>
        <radialGradient id="evidence-lesion" cx="38%" cy="34%" r="75%">
          <stop offset="0" stopColor="#f6dba6" />
          <stop offset="0.55" stopColor="#dfa955" />
          <stop offset="1" stopColor="#9a6a2c" />
        </radialGradient>
        <linearGradient id="evidence-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fc0c9" />
          <stop offset="1" stopColor="#6f97a3" />
        </linearGradient>
      </defs>

      <clipPath id="evidence-frame">
        <rect width={VIEW.width} height={VIEW.height} rx="14" />
      </clipPath>
      <g clipPath="url(#evidence-frame)">
        <rect width={VIEW.width} height={VIEW.height} fill="url(#evidence-parenchyma)" />

        {/* Pleura and chest wall, to place the airway in the lung periphery. */}
        <path d="M720 70 C680 160 668 268 690 372 L720 372 Z" fill="#0b1e26" />
        <path
          d="M720 70 C680 160 668 268 690 372"
          fill="none"
          stroke="#3b6674"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <text
          x="708"
          y="300"
          className={styles.evidenceFaint}
          textAnchor="middle"
          transform="rotate(-90 708 300)"
        >
          pleura
        </text>

        {/* Vessels: quiet context beside the airways. */}
        <g fill="none" stroke="#2a5361" strokeLinecap="round" opacity="0.75">
          <path d="M70 -10 C160 70 236 134 304 200 C352 246 388 296 410 380" strokeWidth="5" />
          <path d="M304 200 C366 216 436 262 512 340" strokeWidth="3.5" />
          <path d="M304 200 C300 262 262 320 250 380" strokeWidth="3.5" />
          <path d="M436 262 C474 250 520 226 560 190 C590 164 616 140 650 124" strokeWidth="2.5" />
          <path d="M150 120 C150 180 120 232 60 262" strokeWidth="2.5" />
        </g>

        {/* Airways: every wall, then every lumen, so the branch points join cleanly. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {AIRWAYS.map((airway) => (
            <path
              key={`wall-${airway.d}`}
              d={airway.d}
              stroke="url(#evidence-wall)"
              strokeWidth={airway.width}
            />
          ))}
          {AIRWAYS.map((airway) => (
            <path
              key={`lumen-${airway.d}`}
              d={airway.d}
              stroke="#0d222b"
              strokeWidth={Math.max(3, airway.width - 7)}
            />
          ))}
        </g>

        <g opacity={showSpecimen ? 0.55 : 1}>
          {/* Catheter */}
          <path
            d={CATHETER}
            fill="none"
            stroke="#e4f1f3"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={CATHETER_TIP.x} cy={CATHETER_TIP.y} r="5" fill="#ffffff" stroke="#0d222b" />
          {step === 0 ? (
            <>
              <line x1="352" y1="198" x2="352" y2="232" className={styles.evidenceLeader} />
              <text x="352" y="248" textAnchor="middle" className={styles.evidenceLabel}>
                catheter
              </text>
            </>
          ) : null}

          {/* Navigation target, from the planning CT */}
          <g data-evidence-target>
            <circle
              cx={TARGET.x}
              cy={TARGET.y}
              r={TARGET.r}
              fill="#e8bb7014"
              stroke="#e8bb70"
              strokeWidth="2.5"
              strokeDasharray="7 5"
            />
            <path
              d={`M${TARGET.x - 7} ${TARGET.y}h14M${TARGET.x} ${TARGET.y - 7}v14`}
              stroke="#e8bb70"
              strokeWidth="1.6"
              opacity={showTool ? 0.5 : 0.9}
            />
            {!showSpecimen ? (
              <text x="584" y="346" textAnchor="middle" className={styles.evidenceTargetLabel}>
                navigation target · planning CT
              </text>
            ) : null}
          </g>

          {/* The lesion as current imaging shows it */}
          {showLesion ? (
            <g data-evidence-lesion>
              <path
                d={LESION_OUTLINE}
                fill="url(#evidence-lesion)"
                stroke="#f4d9a2"
                strokeWidth="1.5"
              />
              {!showSpecimen ? (
                <text
                  x={LESION.x}
                  y="202"
                  textAnchor="middle"
                  className={styles.evidenceLesionLabel}
                >
                  lesion · current imaging
                </text>
              ) : null}
              {step === 1 ? (
                <>
                  <line
                    x1={TARGET.x}
                    y1={TARGET.y}
                    x2={LESION.x}
                    y2={LESION.y}
                    stroke="#f4d9a2"
                    strokeWidth="1.6"
                    strokeDasharray="2 4"
                    strokeLinecap="round"
                  />
                  <text x="640" y="288" className={styles.evidenceLabel}>
                    <tspan x="640">CT-to-body</tspan>
                    <tspan x="640" dy="15">
                      divergence
                    </tspan>
                  </text>
                </>
              ) : null}
            </g>
          ) : null}

          {/* The biopsy tool, its tip and its sampling component */}
          {showTool ? (
            <g data-evidence-tool>
              <line
                x1={CATHETER_TIP.x}
                y1={CATHETER_TIP.y}
                x2={TOOL.tip[0]}
                y2={TOOL.tip[1]}
                stroke="#ffffff"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1={TOOL.windowFrom[0]}
                y1={TOOL.windowFrom[1]}
                x2={TOOL.windowTo[0]}
                y2={TOOL.windowTo[1]}
                stroke="#4fe0c0"
                strokeWidth="6.5"
                strokeLinecap="round"
              />
              {!showSpecimen ? (
                <>
                  {/* Report 1.1: the tip and the sampling component are named on the figure. */}
                  <line
                    x1={TOOL.tip[0] + 3}
                    y1={TOOL.tip[1] - 1}
                    x2="646"
                    y2="230"
                    className={styles.evidenceLeader}
                  />
                  <text x="650" y="230" className={styles.evidenceLabel} data-figure-label="tip">
                    tip
                  </text>
                  <line
                    x1={TOOL.windowTo[0] - 4}
                    y1={TOOL.windowTo[1] + 5}
                    x2="638"
                    y2="282"
                    className={styles.evidenceLeaderTeal}
                  />
                  <text
                    x="642"
                    y="286"
                    className={styles.evidenceToolLabel}
                    data-figure-label="sampling-component"
                  >
                    <tspan x="642">sampling </tspan>
                    <tspan x="642" dy="15">
                      component
                    </tspan>
                  </text>
                </>
              ) : null}
            </g>
          ) : null}
        </g>

        {/* The specimen: a different kind of evidence, not on the image at all. */}
        {showSpecimen ? (
          <g data-evidence-specimen>
            <path
              d={`M${TOOL.windowTo[0]} ${TOOL.windowTo[1] - 6} C${TOOL.windowTo[0]} 190 590 150 584 116`}
              fill="none"
              stroke="#4fe0c0"
              strokeWidth="1.6"
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
            <rect x="452" y="30" width="244" height="86" rx="12" fill="#0b1e26" stroke="#4fe0c0" />
            {/* A glass slide with a tissue core on it. */}
            <rect x="468" y="52" width="58" height="42" rx="4" fill="#12313c" stroke="#9fc0c9" />
            <path
              d="M478 80 C486 66 494 84 502 70 S514 74 518 64"
              fill="none"
              stroke="#e7a3b8"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <text x="540" y="62" className={styles.evidenceCardTitle}>
              specimen
            </text>
            <text x="540" y="82" className={styles.evidenceLabel}>
              result pending
            </text>
            <text x="540" y="100" className={styles.evidenceFaint}>
              no image shows it
            </text>
          </g>
        ) : null}
      </g>
    </svg>
  )
}
