'use client'

import { useId } from 'react'

import { glossaryTerm } from '../../content/glossary'
import {
  obliquityDirection,
  signedDegrees,
  teachingFigure,
  TWO_AXIS_EXAMPLE,
} from '../../content/teachingFigures'
import { FigureCanvas } from './FigureCanvas'
import {
  AXIAL_VIEW,
  twoAxisModel,
  type LesionMark,
  type TargetRay,
  type ToolView,
} from './teachingFigureModel'
import { useFigureComputation } from './useFigureComputation'
import { useTeachingVolume } from './useTeachingData'
import styles from './figures.module.css'

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

function rayRow(ray: TargetRay) {
  return (
    <tr key={`${ray.obliquity}:${ray.tilt}`} data-target-ray={ray.obliquity} data-tilt={ray.tilt}>
      <th scope="row">{signedDegrees(ray.obliquity)}</th>
      <td data-label="Tube side">
        {ray.tubeSide.soft} mm soft tissue
        {ray.tubeSide.bone > 0 ? `, ${ray.tubeSide.bone} mm bone` : ''}
      </td>
      <td data-label="Detector side">
        {ray.detectorSide.soft} mm soft tissue
        {ray.detectorSide.bone > 0 ? `, ${ray.detectorSide.bone} mm bone` : ''}
      </td>
      <td data-label="Soft tissue, whole ray">{ray.softTotal} mm</td>
    </tr>
  )
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
        viewBox="0 0 160 120"
        className={`${styles.svgFigure} ${styles.svgCapped}`}
        role="img"
        aria-label={`${title}: the modeled tool appears ${toolDescription(view)} beside the modeled lesion`}
      >
        <rect width="160" height="120" rx="6" fill="#0b1418" />
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
  const frontalRay = model?.strip.find((ray) => ray.obliquity === 0)
  const chosenRay = model?.strip.find((ray) => ray.obliquity === chosen)
  const beyond = model?.strip.find((ray) => ray.obliquity === -35)
  const opposite = model?.strip.find((ray) => ray.obliquity === -chosen)
  const clears =
    frontalRay && chosenRay ? chosenRay.detectorSide.soft < frontalRay.detectorSide.soft : false
  const tiltNeeded = model ? model.tiltRangeMm > TWO_AXIS_EXAMPLE.tiltToleranceMm : true
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
          The teaching CT could not be loaded here, so the worked example is not drawn. The
          paragraph above describes the technique.
        </p>
      ) : state === 'loading' ? (
        <p className={styles.status} role="status">
          Preparing the worked example from the teaching CT…
        </p>
      ) : null}

      <div className={styles.panelGridWide}>
        <figure className={styles.panel} data-figure-panel="axial">
          <p className={styles.panelTitle}>{panel('axial').title}</p>
          <FigureCanvas
            pixels={model?.axial ?? null}
            size={AXIAL_VIEW.sizePx}
            label={`Axial planning CT through the modeled lesion in the posterior left lung, with the central ray drawn at C-arm obliquity ${TWO_AXIS_EXAMPLE.candidates.map(signedDegrees).join(', ')}`}
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
                    const labelAt: [number, number] = [
                      line.from[0] + (line.to[0] - line.from[0]) * 0.86,
                      line.from[1] + (line.to[1] - line.from[1]) * 0.86,
                    ]
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
                          y={labelAt[1]}
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
                <th scope="col">Tube side</th>
                <th scope="col">Detector side</th>
                <th scope="col">Soft tissue, whole ray</th>
              </tr>
            </thead>
            <tbody>{model ? model.strip.map(rayRow) : null}</tbody>
          </table>
        </div>
      </div>

      {model && frontalRay && chosenRay ? (
        <p data-two-axis-reading>
          <strong>Reading it for this lesion.</strong> Frontally, the detector-side part of the ray
          crosses {frontalRay.detectorSide.soft} mm of soft-tissue-like CT: the density anterior to
          the lesion.{' '}
          {clears
            ? `At C-arm obliquity ${signedDegrees(chosen)} (${obliquityDirection(chosen)}) that part crosses ${chosenRay.detectorSide.soft} mm, and the whole ray ${chosenRay.softTotal} mm instead of ${frontalRay.softTotal} mm.`
            : `At C-arm obliquity ${signedDegrees(chosen)} it crosses ${chosenRay.detectorSide.soft} mm.`}{' '}
          {beyond
            ? `Going further, to ${signedDegrees(beyond.obliquity)}, lengthens the tube-side path instead: ${beyond.tubeSide.soft} mm of soft-tissue-like and ${beyond.tubeSide.bone} mm of bone-like CT.`
            : null}{' '}
          {opposite && frontalRay && opposite.detectorSide.soft > frontalRay.detectorSide.soft
            ? `The opposite sign, ${signedDegrees(opposite.obliquity)}, swings the detector-side part through more of it: ${opposite.detectorSide.soft} mm.`
            : null}{' '}
          Another lesion position needs its own reading: the individual lesion, not a memorized
          rule, decides the angle.
        </p>
      ) : null}

      <div className={styles.panel} data-figure-panel="tilt">
        <p className={styles.panelTitle}>{panel('tilt').title}</p>
        <table className={styles.table}>
          <caption className={styles.panelCaption}>
            {panel('tilt').caption} C-arm obliquity{' '}
            {signedDegrees(TWO_AXIS_EXAMPLE.tiltCheck.obliquity)}.
          </caption>
          <thead>
            <tr>
              <th scope="col">Beam tilt</th>
              <th scope="col">Tube side</th>
              <th scope="col">Detector side</th>
              <th scope="col">Soft tissue, whole ray</th>
            </tr>
          </thead>
          <tbody>
            {model
              ? model.tilts.map((ray) => (
                  <tr key={ray.tilt} data-tilt-row={ray.tilt}>
                    <th scope="row">{signedDegrees(ray.tilt)}</th>
                    <td data-label="Tube side">{ray.tubeSide.soft} mm soft tissue</td>
                    <td data-label="Detector side">{ray.detectorSide.soft} mm soft tissue</td>
                    <td data-label="Soft tissue, whole ray">{ray.softTotal} mm</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {model ? (
          <p className={styles.panelCaption} data-tilt-reading>
            {tiltNeeded
              ? `Across these tilts the detector-side path changes by ${model.tiltRangeMm} mm, so the tilt is worth choosing from the sagittal CT.`
              : `Across these tilts the detector-side path changes by only ${model.tiltRangeMm} mm, so this lesion needs no tilt in this model. Tilt earns its place when the sagittal CT shows a structure over the lesion.`}
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
                    ? 'Frontal projection computed from the teaching CT, collimated around the modeled lesion'
                    : `Projection at C-arm obliquity ${signedDegrees(chosen)}, recentred and collimated around the modeled lesion`
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
          {panel('projections').caption} The dashed teal line is the modeled tool’s approach.
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
        {glossaryTerm('obliquity-and-tilt').definition} Naming these signed angles with a console’s
        labels is held for owner review.
      </p>
    </section>
  )
}
