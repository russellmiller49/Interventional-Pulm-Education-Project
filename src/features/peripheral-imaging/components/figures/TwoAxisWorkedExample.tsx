'use client'

import { useId } from 'react'

import { glossaryTerm } from '../../content/glossary'
import {
  obliquityDirection,
  signedDegrees,
  teachingFigure,
  TWO_AXIS_EXAMPLE,
} from '../../content/teachingFigures'
import { tableCrossing } from '../../lib/rayCrossingTable'
import { rayCrossingLabel, rayCrossingPhrase } from '../../lib/rayStructures'
import { FigureCanvas } from './FigureCanvas'
import {
  AXIAL_VIEW,
  TOOL_VIEW_FRAME,
  twoAxisModel,
  type LesionMark,
  type TargetRay,
  type ToolView,
} from './teachingFigureModel'
import { useFigureComputation } from './useFigureComputation'
import { useTeachingVolume } from './useTeachingData'
import styles from './figures.module.css'

/** Width of a signed-angle label such as "−20°" at the overlay's 10-unit type, in image units. */
const LABEL_WIDTH = 26

const LINE_STYLE: Readonly<Record<number, { stroke: string; dash?: string }>> = {
  0: { stroke: '#e2eef0', dash: '5 4' },
  [TWO_AXIS_EXAMPLE.chosenObliquity]: { stroke: '#f0c27d' },
  20: { stroke: '#77dccf', dash: '1.5 3' },
}

function DashedLesion({
  mark,
  colour = '#f0c27d',
}: {
  readonly mark: LesionMark
  readonly colour?: string
}) {
  return (
    <circle
      cx={mark.x}
      cy={mark.y}
      r={mark.r + 2}
      fill="none"
      stroke={colour}
      strokeWidth="1.2"
      strokeDasharray="2.5 2.5"
    />
  )
}

function crossingRow(ray: TargetRay) {
  return (
    <tr key={`${ray.obliquity}:${ray.tilt}`} data-target-ray={ray.obliquity} data-tilt={ray.tilt}>
      <th scope="row">{signedDegrees(ray.obliquity)}</th>
      <td data-label="Over the nodule">
        {rayCrossingLabel(tableCrossing(ray.obliquity, ray.tilt))}
      </td>
    </tr>
  )
}

/** "−10° or +20°". */
function degreeList(values: readonly number[]): string {
  const signed = values.map(signedDegrees)
  return signed.length <= 1
    ? (signed[0] ?? '')
    : `${signed.slice(0, -1).join(', ')} or ${signed[signed.length - 1]}`
}

function toolDescription(view: ToolView): string {
  if (view.profileFraction >= 0.9) return 'nearly in profile'
  if (view.profileFraction <= 0.3) return 'nearly end-on, foreshortened'
  return 'partly foreshortened'
}

function ToolViewPanel({ view, title }: { readonly view: ToolView; readonly title: string }) {
  return (
    <figure className={styles.panel} data-tool-view={view.obliquity}>
      <svg
        viewBox={`0 0 ${TOOL_VIEW_FRAME.width} ${TOOL_VIEW_FRAME.height}`}
        className={`${styles.svgFigure} ${styles.svgCapped}`}
        role="img"
        aria-label={`${title}: the tool appears ${toolDescription(view)} beside the lesion`}
        data-tool-scale={view.scale}
      >
        <rect width={TOOL_VIEW_FRAME.width} height={TOOL_VIEW_FRAME.height} rx="6" fill="#0b1418" />
        <circle
          cx={view.lesion.x}
          cy={view.lesion.y}
          r={view.lesion.r}
          fill="none"
          stroke="#f0c27d"
          strokeDasharray="2.5 2.5"
        />
        <line
          x1={view.from[0]}
          y1={view.from[1]}
          x2={view.to[0]}
          y2={view.to[1]}
          stroke="#e2eef0"
          strokeWidth="2.5"
          strokeLinecap="round"
          data-tool-line
        />
      </svg>
      <figcaption>
        <strong>{title}</strong> · C-arm obliquity {signedDegrees(view.obliquity)}: the tool is{' '}
        {toolDescription(view)}.
      </figcaption>
    </figure>
  )
}

/**
 * Section 9's CT → two-axis worked example (OD4-08, option A; brief A). Built from the course's
 * teaching CT and its suite geometry, with the model's own signed angles. Every sentence that says
 * which view helps is conditional on the numbers computed here, so the example cannot claim more
 * than the model shows; `model-truth.test.ts` holds the chosen example to the real CT.
 */
export function TwoAxisWorkedExample() {
  const declaration = teachingFigure('two-dimensional:two-axis-example')
  const volume = useTeachingVolume()
  const model = useFigureComputation(volume.data, twoAxisModel)
  const state = volume.state === 'failed' ? 'failed' : model ? 'ready' : 'loading'
  const arrowId = `${useId().replace(/:/g, '')}-arrow`
  const panel = (id: string) => declaration.panels.find((entry) => entry.id === id)!
  const chosen = TWO_AXIS_EXAMPLE.chosenObliquity
  // What lies over the nodule, from the table baked from this CT (model-truth holds it to the CT).
  const frontal = tableCrossing(0, 0)
  const chosenCrossing = tableCrossing(chosen, 0)
  const beyond = tableCrossing(-35, 0)
  const opposite = tableCrossing(-chosen, 0)
  const clears = frontal.mediastinum && !chosenCrossing.mediastinum
  const tiltObliquity = TWO_AXIS_EXAMPLE.tiltCheck.obliquity
  const tiltRows = TWO_AXIS_EXAMPLE.tiltCheck.tilts.map((tilt) => ({
    tilt,
    crossing: tableCrossing(tiltObliquity, tilt),
  }))
  const softTissueRows = tiltRows.filter(
    (row) => row.crossing.mediastinum || row.crossing.diaphragm,
  )
  const spineRows = tiltRows.filter((row) => row.crossing.spine)
  return (
    <section
      className={styles.figure}
      data-teaching-figure={declaration.id}
      data-figure-state={state}
      data-chosen-obliquity={chosen}
    >
      <p className={styles.kicker}>Worked example · from planning CT to two projections</p>
      <p className={styles.modelLabel} data-model-label>
        {declaration.label}
      </p>
      {state === 'failed' ? (
        <p className={styles.status} role="status">
          The images could not be loaded here. The paragraph above describes the technique.
        </p>
      ) : state === 'loading' ? (
        <p className={styles.status} role="status">
          Preparing the worked example…
        </p>
      ) : null}

      <div className={styles.panelGridWide}>
        <figure className={styles.panel} data-figure-panel="axial">
          <p className={styles.panelTitle}>{panel('axial').title}</p>
          <FigureCanvas
            pixels={model?.axial ?? null}
            size={AXIAL_VIEW.sizePx}
            label={`Axial planning CT through the lesion in the posterior left lung, with the axial projection of the target ray from the X-ray tube through the lesion to the detector at C-arm obliquity ${TWO_AXIS_EXAMPLE.candidates.map(signedDegrees).join(', ')}`}
            overlay={
              model ? (
                <>
                  <defs>
                    {model.lines.map((line) => (
                      <marker
                        key={line.obliquity}
                        id={`${arrowId}${line.obliquity}`}
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path
                          d="M0 0 L10 5 L0 10 z"
                          fill={(LINE_STYLE[line.obliquity] ?? { stroke: '#e2eef0' }).stroke}
                        />
                      </marker>
                    ))}
                  </defs>
                  {model.lines.map((line) => {
                    const style = LINE_STYLE[line.obliquity] ?? { stroke: '#e2eef0' }
                    const along = (fraction: number): [number, number] => [
                      line.from[0] + (line.to[0] - line.from[0]) * fraction,
                      line.from[1] + (line.to[1] - line.from[1]) * fraction,
                    ]
                    // The label sits beside the line's detector end, pulled back along the line
                    // until it fits inside the image (the −20° ray leaves near the right edge).
                    let fraction = 0.86
                    while (
                      fraction > 0.5 &&
                      along(fraction)[0] + 4 + LABEL_WIDTH > AXIAL_VIEW.sizePx - 2
                    )
                      fraction -= 0.02
                    const labelAt = along(fraction)
                    return (
                      <g key={line.obliquity} data-beam-line={line.obliquity}>
                        <line
                          x1={line.from[0]}
                          y1={line.from[1]}
                          x2={line.to[0]}
                          y2={line.to[1]}
                          stroke={style.stroke}
                          strokeWidth={line.obliquity === chosen ? 1.8 : 1.2}
                          strokeDasharray={style.dash}
                          markerEnd={`url(#${arrowId}${line.obliquity})`}
                        />
                        <text
                          x={labelAt[0] + 4}
                          y={Math.max(labelAt[1], 12)}
                          fill={style.stroke}
                          fontSize="10"
                          fontWeight="700"
                        >
                          {signedDegrees(line.obliquity)}
                        </text>
                      </g>
                    )
                  })}
                  <DashedLesion mark={model.lesionAxial} />
                  <text x="4" y={AXIAL_VIEW.sizePx / 2} fill="#e2eef0" fontSize="10">
                    R
                  </text>
                  <text
                    x={AXIAL_VIEW.sizePx - 10}
                    y={AXIAL_VIEW.sizePx / 2}
                    fill="#e2eef0"
                    fontSize="10"
                  >
                    L
                  </text>
                  <text x={AXIAL_VIEW.sizePx / 2 - 3} y="11" fill="#e2eef0" fontSize="10">
                    A
                  </text>
                  <text
                    x={AXIAL_VIEW.sizePx / 2 - 3}
                    y={AXIAL_VIEW.sizePx - 3}
                    fill="#e2eef0"
                    fontSize="10"
                  >
                    P
                  </text>
                </>
              ) : undefined
            }
          />
          <figcaption>
            {panel('axial').caption} Displayed as it is read on a CT workstation: the patient’s left
            on the image right (L), anterior at the top (A).
          </figcaption>
        </figure>

        <div className={styles.panel} data-figure-panel="strip">
          <p className={styles.panelTitle}>{panel('strip').title}</p>
          <table className={styles.table}>
            <caption className={styles.panelCaption}>{panel('strip').caption}</caption>
            <thead>
              <tr>
                <th scope="col">C-arm obliquity</th>
                <th scope="col">Over the nodule</th>
              </tr>
            </thead>
            <tbody>{model ? model.strip.map(crossingRow) : null}</tbody>
          </table>
        </div>
      </div>

      {model ? (
        <p data-two-axis-reading>
          <strong>Reading it for this lesion.</strong> Frontally, the X-ray path through the nodule
          crosses {rayCrossingPhrase(frontal)}.{' '}
          {clears
            ? `At C-arm obliquity ${signedDegrees(chosen)} (${obliquityDirection(chosen)}) the heart comes off the path; it now crosses ${rayCrossingPhrase(chosenCrossing)}.`
            : `At C-arm obliquity ${signedDegrees(chosen)} (${obliquityDirection(chosen)}) it crosses ${rayCrossingPhrase(chosenCrossing)}.`}{' '}
          Going further, to {signedDegrees(-35)}, it crosses {rayCrossingPhrase(beyond)}.{' '}
          {opposite.mediastinum
            ? `The opposite sign, ${signedDegrees(-chosen)}, keeps the heart on the path.`
            : null}{' '}
          Another lesion position needs its own reading: the individual lesion, not a memorized
          rule, decides the angle.
        </p>
      ) : null}

      <div className={styles.panel} data-figure-panel="tilt">
        <p className={styles.panelTitle}>{panel('tilt').title}</p>
        <table className={styles.table}>
          <caption className={styles.panelCaption}>
            {panel('tilt').caption} C-arm obliquity {signedDegrees(tiltObliquity)}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Beam tilt</th>
              <th scope="col">Over the nodule</th>
            </tr>
          </thead>
          <tbody>
            {model
              ? tiltRows.map((row) => (
                  <tr key={row.tilt} data-tilt-row={row.tilt}>
                    <th scope="row">{signedDegrees(row.tilt)}</th>
                    <td data-label="Over the nodule">{rayCrossingLabel(row.crossing)}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {model ? (
          <p className={styles.panelCaption} data-tilt-reading>
            {softTissueRows.length === 0
              ? `At C-arm obliquity ${signedDegrees(tiltObliquity)} none of these tilts brings the heart or the diaphragm over the nodule, so this lesion needs no tilt to clear them.${spineRows.length > 0 ? ` Tilting to ${degreeList(spineRows.map((row) => row.tilt))} brings the spine over it instead.` : ''}`
              : `Tilting brings the heart or the diaphragm over the nodule at ${degreeList(softTissueRows.map((row) => row.tilt))}, so the tilt is worth choosing from the sagittal CT.`}
          </p>
        ) : null}
      </div>

      <div className={styles.panel} data-figure-panel="projections">
        <p className={styles.panelTitle}>{panel('projections').title}</p>
        <div className={styles.panelGrid}>
          {(['before', 'after'] as const).map((which) => (
            <figure key={which} className={styles.panel} data-projection={which}>
              <FigureCanvas
                pixels={model ? model.projections[which] : null}
                size={TWO_AXIS_EXAMPLE.projection.sizePx}
                label={
                  which === 'before'
                    ? 'Frontal projection, collimated around the lesion'
                    : `Projection at C-arm obliquity ${signedDegrees(chosen)}, recentered and collimated around the lesion`
                }
                overlay={
                  model ? (
                    <>
                      <DashedLesion
                        mark={
                          which === 'before'
                            ? model.projections.lesionBefore
                            : model.projections.lesionAfter
                        }
                      />
                      {(() => {
                        const [a, b] =
                          which === 'before'
                            ? model.projections.approachBefore
                            : model.projections.approachAfter
                        return (
                          <line
                            x1={a[0]}
                            y1={a[1]}
                            x2={b[0]}
                            y2={b[1]}
                            stroke="#77dccf"
                            strokeWidth="1.2"
                            strokeDasharray="4 3"
                          />
                        )
                      })()}
                    </>
                  ) : undefined
                }
              />
              <figcaption>
                {which === 'before'
                  ? 'Before: frontal, C-arm obliquity 0°'
                  : `After: C-arm obliquity ${signedDegrees(chosen)}, ${obliquityDirection(chosen)}`}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.panelCaption}>
          {panel('projections').caption} The dashed teal line is the tool’s approach.
        </p>
      </div>

      <div className={styles.panel} data-figure-panel="tool-views">
        <p className={styles.panelTitle}>{panel('tool-views').title}</p>
        {model ? (
          <div className={styles.panelGrid}>
            <ToolViewPanel view={model.toolViews.alignment} title="Close to the tool’s axis" />
            <ToolViewPanel view={model.toolViews.advancement} title="Side-on" />
          </div>
        ) : null}
        <p className={styles.panelCaption}>
          {panel('tool-views').caption} A view close to the tool’s axis helps judge whether the
          trajectory is centred on the lesion; the side-on view shows its advancement and depth.
          Neither establishes where the sampling part of the tool lies.
        </p>
      </div>

      <p className={styles.note} data-angle-convention>
        {glossaryTerm('obliquity-and-tilt').definition}
      </p>
    </section>
  )
}
