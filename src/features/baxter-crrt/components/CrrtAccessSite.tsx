'use client'

import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'

import {
  CRRT_ACCESS_SITE_IDS,
  CRRT_ACCESS_SITE_SUMMARY,
  CRRT_ACCESS_TIP_CAPTION,
  crrtAccessSiteTextEquivalent,
  crrtAccessSites,
  type CrrtAccessLumen,
  type CrrtAccessSiteId,
} from '../content/accessSite'
import { CrrtDialog } from './CrrtDialog'
import styles from './crrt-access-site.module.css'

/**
 * The access site a lesson is showing.
 *
 * A lesson holds one choice (right internal jugular to begin with) and every teaching circuit in
 * it draws that site in its inset, so the picture does not change between tasks unless the
 * learner changes it. Outside a lesson there is no provider and no inset: Practice, Challenge and
 * the live run circuits draw exactly as they did.
 */
interface CrrtAccessSiteState {
  readonly site: CrrtAccessSiteId
  readonly setSite: (site: CrrtAccessSiteId) => void
}

const CrrtAccessSiteContext = createContext<CrrtAccessSiteState | null>(null)

export function CrrtAccessSiteProvider({ children }: { readonly children: ReactNode }) {
  const [site, setSite] = useState<CrrtAccessSiteId>('jugular')
  const value = useMemo(() => ({ site, setSite }), [site])
  return <CrrtAccessSiteContext.Provider value={value}>{children}</CrrtAccessSiteContext.Provider>
}

export function useCrrtAccessSite(): CrrtAccessSiteState | null {
  return useContext(CrrtAccessSiteContext)
}

/** The drawing's own frame. The inset uses it as it is; the dialog figure enlarges it. */
export const CRRT_ACCESS_ART_WIDTH = 150
export const CRRT_ACCESS_ART_HEIGHT = 235

/*
 * Both drawings are frontal, as a chest film is read: the patient's right is on the left of the
 * picture (marked R). Veins are drawn as wide translucent channels and the catheter as a pale
 * line inside them, so the catheter is seen in the vein rather than beside it.
 */
const JUGULAR = {
  body: 'M 58 0 L 58 46 C 56 56 40 62 22 68 C 12 72 6 82 6 96 L 6 235 L 144 235 L 144 96 C 144 82 138 72 128 68 C 110 62 94 56 92 46 L 92 0',
  bones: ['M 74 72 C 58 66 40 64 20 70', 'M 76 72 C 92 66 110 64 130 70'],
  heart:
    'M 66 152 C 58 160 56 182 64 198 C 74 216 100 222 116 208 C 128 196 126 172 114 160 C 102 150 78 146 66 152 Z',
  veins: [
    'M 62 2 L 61 70', // right internal jugular
    'M 16 84 C 30 78 46 76 60 74', // right subclavian
    'M 61 72 C 62 86 66 94 69 102', // right brachiocephalic
    'M 88 2 L 89 66', // left internal jugular
    'M 134 84 C 120 76 104 72 90 70', // left subclavian
    'M 89 68 C 86 84 78 96 70 104', // left brachiocephalic
    'M 69 102 L 70 156', // superior vena cava
    'M 73 204 L 73 235', // inferior vena cava
  ],
  catheter: 'M 62 40 L 61 70 C 62 86 66 94 69 102 L 70 150',
  entry: { x: 62, y: 40 },
  tip: { x: 70, y: 150 },
  accessLimb: 'M 62 40 C 54 30 44 24 30 22',
  returnLimb: 'M 62 40 C 50 38 36 38 22 40',
  accessHub: { x: 30, y: 22 },
  returnHub: { x: 22, y: 40 },
  rMark: { x: 14, y: 116 },
} as const

const FEMORAL = {
  body: 'M 22 0 C 16 40 8 90 8 128 L 10 235 L 68 235 L 73 160 L 77 160 L 82 235 L 140 235 L 142 128 C 142 90 134 40 128 0',
  bones: ['M 20 100 C 36 116 56 136 72 150', 'M 130 100 C 114 116 94 136 78 150'],
  heart: null,
  veins: [
    'M 47 235 C 47 200 49 170 52 146', // right femoral
    'M 52 146 C 56 122 62 102 68 78', // right iliac
    'M 103 235 C 103 200 101 170 98 146', // left femoral
    'M 98 146 C 94 122 88 102 80 78', // left iliac
    'M 68 78 C 72 66 74 58 74 50', // right iliac into the cava
    'M 80 78 C 76 66 75 58 75 50',
    'M 74.5 52 L 74.5 0', // inferior vena cava
  ],
  catheter: 'M 49 172 C 50 160 51 152 52 146 C 56 122 62 102 68 78 C 72 66 74 58 74 30',
  entry: { x: 49, y: 172 },
  tip: { x: 74, y: 30 },
  accessLimb: 'M 49 172 C 42 180 34 186 26 190',
  returnLimb: 'M 49 172 C 40 188 30 200 20 208',
  accessHub: { x: 26, y: 190 },
  returnHub: { x: 20, y: 208 },
  rMark: { x: 18, y: 60 },
} as const

const ART = { jugular: JUGULAR, femoral: FEMORAL } as const

/**
 * The drawing itself, as SVG content in a 150 × 235 frame. It carries no text of its own besides
 * the R marker and the A and V on the two hubs; captions and labels belong to whoever places it.
 */
export function CrrtAccessSiteArt({
  site,
  highlight = null,
}: {
  readonly site: CrrtAccessSiteId
  readonly highlight?: CrrtAccessLumen | null
}) {
  const art = ART[site]
  return (
    <g data-crrt-access-art={site} data-highlight={highlight ?? undefined}>
      <path d={art.body} className={styles.body} />
      {art.bones.map((d) => (
        <path key={d} d={d} className={styles.bone} />
      ))}
      {art.heart ? <path d={art.heart} className={styles.heart} /> : null}
      {art.veins.map((d) => (
        <path key={d} d={d} className={styles.vein} />
      ))}
      <path d={art.catheter} className={styles.catheter} />
      <circle cx={art.tip.x} cy={art.tip.y} r="3.2" className={styles.tip} />
      <path
        d={art.accessLimb}
        className={styles.limb}
        data-lumen="access"
        data-lit={highlight === 'access'}
      />
      <path
        d={art.returnLimb}
        className={styles.limb}
        data-lumen="return"
        data-lit={highlight === 'return'}
      />
      <circle cx={art.entry.x} cy={art.entry.y} r="3.4" className={styles.entry} />
      {(
        [
          ['access', art.accessHub, 'A'],
          ['return', art.returnHub, 'V'],
        ] as const
      ).map(([lumen, hub, mark]) => (
        <g key={lumen} transform={`translate(${hub.x} ${hub.y})`}>
          <circle
            r="7.5"
            className={styles.hub}
            data-lumen={lumen}
            data-lit={highlight === lumen}
          />
          <text y="3.4" textAnchor="middle" className={styles.hubMark}>
            {mark}
          </text>
        </g>
      ))}
      <text x={art.rMark.x} y={art.rMark.y} textAnchor="middle" className={styles.sideMark}>
        R
      </text>
    </g>
  )
}

/**
 * The inset in the circuit drawing: the picture behind the PATIENT circle, placed in the free
 * corner above it with a short lead to the circle. SVG content, in the circuit's own coordinates.
 */
export function CrrtAccessSiteInset({
  site,
  highlight = null,
}: {
  readonly site: CrrtAccessSiteId
  readonly highlight?: CrrtAccessLumen | null
}) {
  const entry = crrtAccessSites[site]
  return (
    <g data-crrt-access-site={site} className={styles.inset}>
      <rect x="30" y="62" width="150" height="250" rx="14" className={styles.insetFrame} />
      <text x="105" y="78" textAnchor="middle" className={styles.insetTitle}>
        ACCESS SITE
      </text>
      <g transform="translate(39 84) scale(0.88)">
        <CrrtAccessSiteArt site={site} highlight={highlight} />
      </g>
      <text x="105" y="304" textAnchor="middle" className={styles.insetCaption}>
        {entry.insetCaption}
      </text>
      {/* The lead from the picture to the circle it stands for. */}
      <path d="M 108 312 L 110 327" className={styles.insetLead} />
    </g>
  )
}

/** The catheter's end inside the vein: where blood is taken and where it is returned. */
function CrrtAccessTipDetail() {
  const titleId = useId()
  return (
    <figure className={styles.tipFigure} data-crrt-access-tip>
      <svg viewBox="0 0 360 120" role="img" aria-labelledby={titleId} className={styles.tipSvg}>
        <title id={titleId}>
          The catheter tip inside the vein. Blood in the vein flows toward the heart. It is drawn
          into the catheter through the access openings, a short way back from the tip, and returned
          from the opening at the tip.
        </title>
        <defs>
          <marker
            id={`${titleId}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={styles.tipArrowHead} />
          </marker>
        </defs>
        <rect x="6" y="26" width="348" height="68" rx="34" className={styles.tipVein} />
        <path d="M 6 60 L 232 60" className={styles.tipCatheter} />
        <path d="M 6 60 L 232 60" className={styles.tipSeptum} />
        {[150, 164, 178].map((x) => (
          <circle key={x} cx={x} cy="52" r="3" className={styles.tipHole} />
        ))}
        <path
          d="M 150 34 L 160 47"
          className={styles.tipFlow}
          data-lumen="access"
          markerEnd={`url(#${titleId}-arrow)`}
        />
        <path
          d="M 176 34 L 170 47"
          className={styles.tipFlow}
          data-lumen="access"
          markerEnd={`url(#${titleId}-arrow)`}
        />
        <path
          d="M 236 64 L 278 64"
          className={styles.tipFlow}
          data-lumen="return"
          markerEnd={`url(#${titleId}-arrow)`}
        />
        <path
          d="M 296 40 L 338 40"
          className={styles.tipFlow}
          data-lumen="vein"
          markerEnd={`url(#${titleId}-arrow)`}
        />
        <text x="140" y="20" textAnchor="middle" className={styles.tipLabel}>
          Access openings: blood out
        </text>
        <text x="258" y="86" textAnchor="middle" className={styles.tipLabel}>
          Return: blood back
        </text>
        <text x="317" y="20" textAnchor="middle" className={styles.tipLabel}>
          To the heart
        </text>
        <text x="40" y="112" textAnchor="middle" className={styles.tipLabel}>
          Catheter
        </text>
      </svg>
      <figcaption>{CRRT_ACCESS_TIP_CAPTION}</figcaption>
    </figure>
  )
}

/** The enlarged, labelled figure with the choice of site. */
export function CrrtAccessSiteFigure({
  site,
  onSiteChange,
}: {
  readonly site: CrrtAccessSiteId
  readonly onSiteChange: (site: CrrtAccessSiteId) => void
}) {
  const titleId = useId()
  const entry = crrtAccessSites[site]
  const labelX = 176
  const rowY = (row: number) => 24 + row * 32
  return (
    <div className={styles.figureLayout} data-crrt-access-figure={site}>
      <div className={styles.siteChoice} role="group" aria-label="Catheter site">
        {CRRT_ACCESS_SITE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === site}
            onClick={() => onSiteChange(id)}
          >
            {crrtAccessSites[id].name}
          </button>
        ))}
      </div>
      <figure className={styles.figure}>
        <svg
          viewBox={`0 0 400 ${CRRT_ACCESS_ART_HEIGHT + 10}`}
          role="img"
          aria-labelledby={titleId}
          className={styles.figureSvg}
        >
          <title id={titleId}>{crrtAccessSiteTextEquivalent(site)}</title>
          <g transform="translate(6 5)">
            <CrrtAccessSiteArt site={site} />
            {entry.labels.map((label) => (
              <g key={label.id} data-crrt-access-label={label.id}>
                <path
                  d={`M ${label.at.x} ${label.at.y} L ${labelX - 8} ${rowY(label.row) - 4}`}
                  className={styles.leader}
                />
                <circle cx={label.at.x} cy={label.at.y} r="2" className={styles.leaderDot} />
                <text x={labelX} y={rowY(label.row)} className={styles.label}>
                  {label.text}
                </text>
              </g>
            ))}
          </g>
        </svg>
        <figcaption>
          <strong>{entry.name}.</strong> {entry.route}
        </figcaption>
      </figure>
      <CrrtAccessTipDetail />
    </div>
  )
}

/** The button under the circuit that opens the enlarged figure. */
export function CrrtAccessSiteButton() {
  const state = useCrrtAccessSite()
  if (!state) return null
  return (
    <CrrtDialog
      title="Where the circuit meets the patient"
      description={CRRT_ACCESS_SITE_SUMMARY}
      trigger={
        <button type="button" className={styles.trigger} data-crrt-access-site-trigger>
          <Maximize2 aria-hidden="true" /> Access site
        </button>
      }
    >
      <CrrtAccessSiteFigure site={state.site} onSiteChange={state.setSite} />
    </CrrtDialog>
  )
}
