import type { CtTrace } from '../content/ct-types'
import type { LocalAction, LocalSession } from '../engine/local-session'
import { nativeImageUrl, ORIENTATION_NOTES } from '../geometry/native-ct'
import {
  orientationFor,
  orientationLabels,
  orientationName,
  orientationTransform,
  sameOrientation,
  STANDARD_ORIENTATION,
  type CtOrientation,
} from '../geometry/orientation'
import { ObserverReference } from './CtViewpointComparison'
import styles from './branch-tracing.module.css'

function OrientationImage({ trace, orientation }: { trace: CtTrace; orientation: CtOrientation }) {
  const labels = orientationLabels(orientation)
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Parent airway on CT: ${orientationName(orientation)}. Top ${labels.top}, right ${labels.right}, bottom ${labels.bottom}, left ${labels.left}.`}
    >
      <g
        transform={`translate(50 50) ${orientationTransform(orientation)} scale(${100 / 110}) translate(${-trace.anchor.pixel[0]} ${-trace.anchor.pixel[1]})`}
      >
        <image
          href={nativeImageUrl(trace.anchor.slice)}
          x={-0.5}
          y={-0.5}
          width="512"
          height="512"
        />
      </g>
      <circle cx="50" cy="50" r="4" fill="none" stroke="#f6c66c" strokeWidth=".7" />
      {[
        { text: labels.top, x: 50, y: 9 },
        { text: labels.right, x: 94, y: 52 },
        { text: labels.bottom, x: 50, y: 96 },
        { text: labels.left, x: 6, y: 52 },
      ].map((v) => (
        <text
          key={v.text}
          x={v.x}
          y={v.y}
          textAnchor="middle"
          fill="white"
          fontSize="7"
          stroke="#020507"
          strokeWidth="1.5"
          paintOrder="stroke"
        >
          {v.text}
        </text>
      ))}
    </svg>
  )
}
export const orientationActionLabel = (trace: CtTrace) =>
  trace.preset === 'mirror'
    ? 'Compare with the caudal tracing view'
    : trace.preset === 'rul'
      ? 'Rotate 90° counterclockwise'
      : 'Rotate 90° clockwise'

export function CtOrientationTeaching({
  trace,
  guide,
}: {
  trace: CtTrace
  guide?: {
    step: NonNullable<LocalSession['orientationGuide']>
    orientation: CtOrientation
    onAction: (action: LocalAction) => void
  }
}) {
  const expected = orientationFor(trace.preset)
  if (guide)
    return (
      <section aria-label="CT orientation teaching" className={styles.orientationGuide}>
        {guide.step === 'context' ? (
          <>
            <h2>Begin with standard axial CT</h2>
            <p>
              Imagine looking up at the patient from the feet. Patient <strong>R</strong> is on
              screen-left and <strong>L</strong> on screen-right; <strong>A</strong> (anterior) is
              at the top and <strong>P</strong> (posterior) at the bottom.
            </p>
            <p>
              The gold crosshair locates <strong>{trace.anchor.airway.name}</strong> within the full
              CT field. Focus on this airway before following it through neighboring slices.
            </p>
            <ObserverReference />
            <p>
              Later, you will reflect or rotate this display to compare branch directions with the
              view down an airway. First, establish the usual CT view.
            </p>
          </>
        ) : guide.step === 'direction' ? (
          <>
            <h2>Patient, display and parent-airway viewpoint</h2>
            <p>
              Patient anatomy stays fixed. CT presents a cross-section; the parent-airway observer
              looks along the lumen with a separately defined camera roll: the patient direction
              held at the top of that view, declared per region. The parent airway view beside the
              CT copies shows that camera; it does not turn or reflect when the CT display does.
            </p>
            <ObserverReference />
            <p>
              {trace.preset === 'mirror'
                ? 'In the straight central-airway reference, standard axial looks from feet toward head. The parent observer looks in the opposite direction, toward the carina, with anterior held at the top. Reflecting the comparison CT helps compare that left–right relationship. This remains a cross-section, not a bronchoscope image.'
                : trace.preset === 'rul'
                  ? 'For this right upper lobe example, the tracing display uses a 90° counterclockwise rotation from standard axial.'
                  : 'For this left upper division example, the tracing display uses a 90° clockwise rotation from standard axial.'}
            </p>
            <p>
              The patient and airway stay fixed. Select{' '}
              <strong>{orientationActionLabel(trace)}</strong> to change only the comparison
              display. The standard copy stays fixed. The same slice, crop, window and landmark
              remain in both copies.
            </p>
          </>
        ) : (
          <>
            <h2>Compare the same CT</h2>
            <div
              className={styles.walkthroughControls}
              role="group"
              aria-label="Compare CT display orientation"
            >
              <button
                aria-pressed={sameOrientation(guide.orientation, STANDARD_ORIENTATION)}
                onClick={() => guide.onAction({ type: 'orientation', value: STANDARD_ORIENTATION })}
              >
                Return to standard axial
              </button>
              <button
                aria-pressed={sameOrientation(guide.orientation, expected)}
                onClick={() => guide.onAction({ type: 'orientation', value: expected })}
              >
                Replay comparison
              </button>
            </div>
            <p>
              {trace.preset === 'mirror'
                ? 'With reflection, R and L exchange sides while A stays at the top. The patient has not moved.'
                : 'All four direction markers turn with the CT. The patient has not moved.'}
            </p>
            {trace.preset === 'mirror' && trace.anchor.airway.code === 'Trachea' && (
              <p data-symmetric-note>
                At this level the trachea is a nearly round, midline lumen, so the reflection
                changes little inside the airway itself: watch the R and L letters and the
                asymmetric lung and mediastinal outlines swap sides. At a division whose daughters
                lie on different sides of the patient, the same reflection swaps their screen
                positions, which is why the display convention matters before the divisions ahead.
                The parent airway view beside the CT copies does not change: it is a separate
                camera, not a copy of the display.
              </p>
            )}
            {/* BBT-01 replaced the "What changed?" check with this direct comparison: it repeated
                the sentence above for one extra click. The three teaching points stay visible. */}
            <dl className={styles.orientationComparison} data-orientation-comparison>
              <div>
                <dt>Changed</dt>
                <dd>Only the CT display: where the patient directions sit on your screen.</dd>
              </div>
              <div>
                <dt>Unchanged</dt>
                <dd>The patient, the CT slice and the airway you are following.</dd>
              </div>
              <div>
                <dt>Still a cross-section</dt>
                <dd>
                  Both copies are CT slices across the airway. A bronchoscope looks along the lumen
                  instead.
                </dd>
              </div>
            </dl>
            <p>
              The parent direction and camera roll must be re-established as the airway turns. These
              buttons step between displays without animation and change only the display.
            </p>
          </>
        )}
      </section>
    )
  return (
    <section>
      <h2>Turn the CT into the tracing convention</h2>
      <p>
        Standard axial looks from the feet: patient R appears on your left, with A at the top. The
        bronchoscope looks from the parent toward the daughter branches.
      </p>
      <figure className={styles.orientationDiagram}>
        <div>
          <OrientationImage trace={trace} orientation={STANDARD_ORIENTATION} />
          <span aria-hidden="true">→</span>
          <OrientationImage trace={trace} orientation={expected} />
        </div>
        <figcaption>
          <strong>Standard axial → {orientationName(expected).toLowerCase()}.</strong> The ring
          identifies the same parent lumen. Follow the direction letters as the image turns.
        </figcaption>
      </figure>
      <p>{ORIENTATION_NOTES[trace.preset]}</p>
      <p>
        <strong>Try it in the paired viewer:</strong> use the rotate or flip buttons. “Show book
        convention” demonstrates the result; “Return to standard axial” lets you repeat it.
      </p>
      <p>
        A reflection swaps left and right while keeping anterior at the top. A rotation turns all
        four directions. Neither changes the patient’s anatomy.
      </p>
      <p>
        Then compare the neighboring branch openings in virtual bronchoscopy. The CT is a
        cross-section; the scope looks along the lumen. Horizontal branches still require you to
        reason from the parent’s direction.
      </p>
    </section>
  )
}

export function CtOrientationFeedback({
  trace,
  used,
}: {
  trace: CtTrace
  first?: CtOrientation
  used: CtOrientation
}) {
  return (
    <p>
      <strong>Display:</strong> you traced in {orientationName(used).toLowerCase()}. The book
      convention for this region is {orientationName(orientationFor(trace.preset)).toLowerCase()};
      standard axial is also a valid tracing display.
    </p>
  )
}
