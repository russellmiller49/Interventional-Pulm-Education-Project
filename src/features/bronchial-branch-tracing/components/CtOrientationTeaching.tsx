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
    ? 'Reflect left ↔ right'
    : trace.preset === 'rul'
      ? 'Rotate 90° counterclockwise'
      : 'Rotate 90° clockwise'

export const ORIENTATION_CHECK_FEEDBACK = {
  display:
    'Correct. The airway is unchanged; only the CT display orientation changed. It remains a cross-section. Continue when ready.',
  anatomy:
    'The airway anatomy has not changed. Compare the same lumen in both displays, then try again.',
  bronchoscopy:
    'This remains a CT cross-section. A bronchoscope looks along the lumen. Try the check again.',
}

export function CtOrientationTeaching({
  trace,
  guide,
}: {
  trace: CtTrace
  guide?: {
    step: NonNullable<LocalSession['orientationGuide']>
    orientation: CtOrientation
    response?: 'display' | 'anatomy' | 'bronchoscopy'
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
              The gold ring locates <strong>{trace.anchor.airway.name}</strong> within the full CT
              field. Focus on this airway before following it through neighboring slices.
            </p>
            <p>
              Later, you will reflect or rotate this display to compare branch directions with the
              view down an airway. First, establish the usual CT view.
            </p>
          </>
        ) : guide.step === 'direction' ? (
          <>
            <h2>CT and bronchoscopy look in different directions</h2>
            <p>
              The CT is still in standard axial: patient R on your left, A at the top. CT shows a
              cross-section. A bronchoscope looks forward through the parent airway toward its
              daughter branches.
            </p>
            <p
              className={styles.viewingDirection}
              aria-label="Bronchoscope looks from observer through parent bronchus toward daughter bronchi"
            >
              Observer → parent bronchus → daughter bronchi
            </p>
            <p>
              {trace.preset === 'mirror'
                ? 'For this caudally directed example, a left–right reflection makes branch directions easier to compare with the view down the parent airway.'
                : trace.preset === 'rul'
                  ? 'For this right upper lobe example, the tracing display uses a 90° counterclockwise rotation from standard axial.'
                  : 'For this left upper division example, the tracing display uses a 90° clockwise rotation from standard axial.'}
            </p>
            <p>
              Select <strong>{orientationActionLabel(trace)}</strong>. Watch the direction letters
              move on the same CT slice. The window, zoom and airway reference stay the same.
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
                Standard axial
              </button>
              <button
                aria-pressed={sameOrientation(guide.orientation, expected)}
                onClick={() => guide.onAction({ type: 'orientation', value: expected })}
              >
                Show tracing view
              </button>
            </div>
            <p>
              {trace.preset === 'mirror'
                ? 'R and L exchange sides; A stays at the top.'
                : 'All four direction markers turn with the CT.'}
            </p>
            <fieldset className={styles.orientationCheck}>
              <legend>What changed? · Ungraded check</legend>
              {(
                [
                  ['anatomy', 'The patient’s airway anatomy'],
                  ['display', 'Only the CT display orientation'],
                  ['bronchoscopy', 'The CT became a bronchoscopic image'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={guide.response === value}
                  onClick={() => guide.onAction({ type: 'orientation-response', value })}
                >
                  {label}
                </button>
              ))}
            </fieldset>
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
        convention” demonstrates the result; “Reset to standard” lets you repeat it.
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
  first,
  used,
}: {
  trace: CtTrace
  first: CtOrientation
  used: CtOrientation
}) {
  return (
    <p>
      <strong>Orientation:</strong> first choice {orientationName(first).toLowerCase()}; recorded{' '}
      {orientationName(used).toLowerCase()}. The book convention for this region is{' '}
      {orientationName(orientationFor(trace.preset)).toLowerCase()}. This compares a display
      convention, not bronchoscopy competence.
    </p>
  )
}
