'use client'

import type {
  Course,
  CtBranchChoice,
  CtCheckpoint,
  CtMark,
  CtTrace,
  TargetRelation,
} from '../content/ct-types'
import {
  COURSE_OPTIONS,
  TARGET_RELATION_OPTIONS,
  TARGET_RELATION_FEEDBACK,
} from '../content/ct-types'
import { junctionFeedbackPacket } from '../content/junction-feedback'
import {
  continuationReference,
  divisionLevels,
  levelPhrase,
  routeLevels,
  type ApproachReference,
} from '../engine/model-reference'
import { count, displayName, displayOptionLabel } from '../engine/display-text'
import styles from './branch-tracing.module.css'

export function CtTraceList({
  trace,
  marks,
  active,
  onActive,
  recorded = [],
  maxActive = trace.checkpoints.length - 1,
}: {
  trace: CtTrace
  marks: (CtMark | null)[]
  active: number
  onActive?: (index: number) => void
  recorded?: boolean[]
  maxActive?: number
}) {
  return (
    <div className={styles.traceList}>
      <h3>Route checkpoints</h3>
      <p className={styles.small}>
        {trace.checkpoints.filter((p) => p.decision).length} branch decisions, then the distal
        nodule approach. {recorded.filter(Boolean).length} of{' '}
        {count(trace.checkpoints.length, 'stop')} recorded.
      </p>
      <details>
        <summary>Review the route in order</summary>
        <ol>
          {trace.checkpoints.map((point, i) => (
            <li key={point.id}>
              <button
                aria-current={active === i ? 'step' : undefined}
                onClick={() => onActive?.(i)}
                disabled={!onActive || i > maxActive}
                aria-label={
                  i > maxActive
                    ? `Stop ${i + 1}: locked`
                    : `Stop ${i + 1}: ${point.decision ? displayName(point.decision.parent.airway.name) : 'Distal nodule approach'}`
                }
              >
                <span aria-hidden="true">{recorded[i] ? '✓' : i + 1}</span>
                <div>
                  <strong>
                    {i > maxActive
                      ? 'Continue through the preceding junctions'
                      : point.decision
                        ? `${point.decision.parent.airway.code} junction`
                        : 'Distal nodule approach'}
                  </strong>
                  {i <= maxActive && (
                    <small>
                      {recorded[i]
                        ? 'Response recorded · review only'
                        : !marks[i]
                          ? 'Choose a daughter and mark its lumen'
                          : marks[i]?.pixel === null
                            ? 'Lumen unresolved · ready to record'
                            : 'Lumen marked · record this junction'}
                    </small>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ol>
      </details>
    </div>
  )
}
export function CtBranchDecision({
  trace,
  active,
  choice,
  onChange,
  recorded = false,
  reveal = false,
  worked = false,
}: {
  trace: CtTrace
  active: number
  choice: CtBranchChoice | null
  onChange?: (value: CtBranchChoice) => void
  recorded?: boolean
  reveal?: boolean
  /** A worked example's junction: no question is posed and nothing is attributed to the learner. */
  worked?: boolean
}) {
  const point = trace.checkpoints[active],
    decision = point.decision
  if (!decision)
    return (
      <p>
        Mark the last visible airway toward the nodule, or record that the lumen is unresolved. This
        is the distal approach after all branch decisions.
      </p>
    )
  const chosen = decision.options.find((o) => o.sourceEdgeId === choice)
  const reference = decision.options.find((o) => o.sourceEdgeId === point.sourceEdgeId)!
  // A learner may move past a junction without choosing; never present that as a recorded choice.
  const recordedChoice =
    choice === null
      ? 'No branch choice was recorded at this junction.'
      : `Your recorded choice: ${chosen ? displayOptionLabel(chosen.label) : 'Daughter branch unresolved'}.`
  return (
    <div className={styles.branchDecision}>
      <p>
        <strong>Parent: {decision.parent.airway.code}</strong> ·{' '}
        {displayName(decision.parent.airway.name)}
      </p>
      {!recorded && !worked && (
        <fieldset disabled={!onChange}>
          <legend>Which daughter continues toward the target?</legend>
          {decision.options.map((option) => (
            <label key={option.sourceEdgeId}>
              <input
                type="radio"
                name={`branch-${trace.id}-${point.id}`}
                value={option.sourceEdgeId}
                checked={choice === option.sourceEdgeId}
                onChange={() => onChange?.(option.sourceEdgeId)}
              />
              <span>
                <strong>{displayOptionLabel(option.label)}</strong>
                <small>{option.direction} in patient coordinates</small>
              </span>
            </label>
          ))}
          <label>
            <input
              type="radio"
              name={`branch-${trace.id}-${point.id}`}
              value="unresolved"
              checked={choice === 'unresolved'}
              onChange={() => onChange?.('unresolved')}
            />
            <span>Cannot establish the daughter branch</span>
          </label>
        </fieldset>
      )}
      {recorded && !reveal && <p>{recordedChoice}</p>}
      {reveal && (
        <div className={styles.feedback} role="status" data-branch-comparison={point.id}>
          <strong>{recorded ? 'Junction comparison' : 'Worked junction'}</strong>
          <p>Model reference — not yet faculty reviewed.</p>
          {recorded && <p>{recordedChoice}</p>}
          <p>
            The model reference route continues through{' '}
            <strong>{displayOptionLabel(reference.label)}</strong>.{' '}
            {decision.options.filter((o) => o.airway.code === reference.airway.code).length > 1
              ? 'These daughters share a bronchial name. Follow their separate lumens; sharing a segment name does not make them the same branch.'
              : `The other ${decision.options.length === 2 ? 'daughter leaves' : 'daughters leave'} this route at the same junction. Compare the parent and each opening on the CT and the paired airway view.`}
          </p>
          <p>
            Compare any lumen mark with the gold cross and browse the intervening slices. A valid
            lumen mark need not lie on the centerline; a difference is not an automatic error. The
            next junction follows the model reference route; your own responses stay as you left
            them.
          </p>
        </div>
      )}
    </div>
  )
}
export function CtJunctionTeaching({ trace, active }: { trace: CtTrace; active: number }) {
  const point = trace.checkpoints[active]
  const decision = point.decision
  if (!decision) return null
  // Where the packet already records that the response plane precedes a visible separation,
  // say so before the task rather than only in the comparison afterwards.
  const limitation = junctionFeedbackPacket(point.id)?.entryLimitation
  return (
    <section className={styles.junctionTeaching} aria-label="Current airway division">
      <h2>This junction</h2>
      {limitation && (
        <p className={styles.entryLimitation} data-entry-limitation={point.id}>
          {limitation}
        </p>
      )}
      <div className={styles.junctionParent}>
        {decision.parent.airway.code}
        <small>{displayName(decision.parent.airway.name)}</small>
      </div>
      <div className={styles.junctionDaughters}>
        {decision.options.map((option) => (
          <div key={option.sourceEdgeId}>
            <span aria-hidden="true">↓</span>
            <strong>{option.airway.code}</strong>
            <small>{option.direction}</small>
          </div>
        ))}
      </div>
      <p>
        One parent, {decision.options.length} daughters. Locate the parent on CT, follow its walls
        through the division, then select the daughter that continues toward the target.
      </p>
      <p className={styles.small}>
        This diagram shows connections, not screen positions. Direction words compare the daughters
        in patient coordinates. Repeated names identify separate branches within the same named
        bronchus; no finer segment name is assigned.
      </p>
    </section>
  )
}
export function CtAirwayGuide({
  trace,
  pending = false,
  active = 0,
}: {
  trace: CtTrace
  pending?: boolean
  active?: number
}) {
  const airways = pending
    ? [trace.checkpoints[active].decision?.parent.airway ?? trace.anchor.airway]
    : trace.airwayPath
  return (
    <div className={styles.airwayGuide}>
      <h3>Airway names</h3>
      <p aria-label={pending ? 'Current named parent' : 'Named airway route'}>
        {airways.map((airway, i) => (
          <span key={`${i}-${airway.code}`}>
            {i > 0 && <span aria-hidden="true"> → </span>}
            <abbr title={displayName(airway.name)}>{airway.code}</abbr>
          </span>
        ))}
      </p>
      <p>
        R/L identifies the side; B denotes a bronchus and S its pulmonary segment. Numbers identify
        segmental bronchi; a, b and c identify subsegments. A distal branch can divide again while
        retaining the same verified bronchial name.
      </p>
    </div>
  )
}
export function CtCourseControl({
  value,
  onChange,
  from,
}: {
  value: Course | ''
  onChange: (value: Course) => void
  from?: string
}) {
  return (
    <label className={styles.courseChoice}>
      <strong>
        {from
          ? `How does the airway continue from ${from} toward the nodule?`
          : 'How does this part of the airway continue?'}
      </strong>
      <select
        aria-label="Airway course"
        value={value}
        onChange={(e) => onChange(e.target.value as Course)}
      >
        <option value="" disabled>
          Choose the course you traced
        </option>
        {Object.entries(COURSE_OPTIONS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CtTargetRelationControl({
  value,
  onChange,
}: {
  value: TargetRelation | ''
  onChange: (value: TargetRelation) => void
}) {
  return (
    <label className={styles.courseChoice}>
      <strong>How does the airway relate to the nodule?</strong>
      <select
        aria-label="Airway–nodule relationship"
        value={value}
        onChange={(e) => onChange(e.target.value as TargetRelation)}
      >
        <option value="" disabled>
          Choose what the CT supports
        </option>
        {Object.entries(TARGET_RELATION_OPTIONS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CtTargetFeedback({
  value,
  reference,
}: {
  value: TargetRelation
  reference?: ApproachReference
}) {
  return (
    <>
      <p>
        <strong>Your airway–nodule interpretation:</strong> {TARGET_RELATION_OPTIONS[value]}.
      </p>
      <p>{TARGET_RELATION_FEEDBACK[value]}</p>
      {reference && (
        <div data-target-reference={reference.segmentCode}>
          <p>
            <strong>Model reference:</strong> the source places this simulated nodule in{' '}
            {reference.segmentCode} ({reference.segmentName.toLowerCase()}) at the end of{' '}
            {reference.approachCode}
            {reference.matchesRoute
              ? `, which is this route's distal checkpoint (${reference.distalCode}).`
              : `; this route's distal checkpoint is ${reference.distalCode}.`}{' '}
            That is how the target was placed in the source data. It is not a reviewed finding that
            the distal lumen can be followed to it on this scan, and it does not establish
            instrument reach or tool-in-lesion.
          </p>
          {value !== 'approaches' && (
            <p>
              The source records only where the target was placed. It holds no record of a
              neighbouring structure or of where the air column stops being resolvable, so what you
              recorded here cannot be compared with a model answer; keep it as your reading and
              revisit the last definite lumen.
            </p>
          )}
        </div>
      )}
    </>
  )
}

/**
 * The learner's recorded course beside what the source actually records. The module has no
 * reviewed course label, so the two are shown side by side and never matched automatically.
 */
export function CtCourseFeedback({
  value,
  trace,
  checkpoint,
}: {
  value: Course
  trace?: CtTrace
  checkpoint?: CtCheckpoint
}) {
  const division = checkpoint ? divisionLevels(checkpoint) : null
  const route = trace ? routeLevels(trace) : null
  return (
    <div data-course-feedback={value}>
      <p>
        <strong>Your recorded course:</strong> {COURSE_OPTIONS[value]}.
      </p>
      {division && (
        <p>
          <strong>Source levels:</strong> the parent point for {division.parentCode} lies on slice{' '}
          {division.parentSlice}.{' '}
          {division.daughters
            .map(
              (d) =>
                `${d.label} is marked on slice ${d.slice}, ${levelPhrase(d)}, with the source direction label “${d.direction}”`,
            )
            .join('; ')}
          .
        </p>
      )}
      {route && (
        <p>
          <strong>Source levels:</strong> this route&rsquo;s supplied points run{' '}
          {route.levels.map((l) => `${l.code} ${l.slice}`).join(' → ')}; overall {route.net}, with{' '}
          {route.reversals === 0
            ? 'no change of cranial–caudal direction'
            : `${route.reversals} change${route.reversals === 1 ? '' : 's'} of cranial–caudal direction`}
          .
        </p>
      )}
      <p className={styles.small}>
        The source records point levels and daughter direction labels. It holds no reviewed course
        description for what you traced, so your answer is not matched against one and nothing is
        recorded as right or otherwise. Compare the two yourself, and revisit any interval where
        they do not agree.
      </p>
    </div>
  )
}

/**
 * Which daughter the source reference route continues through, why the two daughters are
 * distinguishable in the source data, and what to revisit. Choosing differently is not an error.
 */
export function CtContinuationFeedback({
  checkpoint,
  choice,
  onGoToSlice,
}: {
  checkpoint: CtCheckpoint
  choice: CtBranchChoice | null
  onGoToSlice?: (slice: number) => void
}) {
  const reference = continuationReference(checkpoint)
  const division = divisionLevels(checkpoint)
  if (!reference || !division || !checkpoint.decision) return null
  const index = checkpoint.decision.options.findIndex((o) => o.sourceEdgeId === choice)
  const chosen = index >= 0 ? division.daughters[index] : null
  return (
    <div data-continuation-feedback={checkpoint.id}>
      <p>
        <strong>Your recorded continuation:</strong>{' '}
        {chosen
          ? `${chosen.label}, marked on slice ${chosen.slice}, ${levelPhrase(chosen)}, source direction label “${chosen.direction}”.`
          : choice === 'unresolved'
            ? 'continuation unresolved. That response stays unresolved; it is not turned into a branch.'
            : 'no continuation was recorded at this division.'}
      </p>
      <p>
        <strong>Model reference route:</strong> it continues through {reference.label}, marked on
        slice {reference.slice}, {levelPhrase(reference)}, source direction label “
        {reference.direction}”.
        {reference.sharedName
          ? ` Both daughters of this division carry the name ${reference.code}: the name does not tell them apart, their levels and directions do.`
          : ''}
      </p>
      {chosen && chosen.label !== reference.label && (
        <p>
          The two differ in level and direction, not only in name. Return to {division.parentCode}{' '}
          on slice {division.parentSlice} and follow each daughter lumen away from the division
          before deciding which one you were in. A different choice is not recorded as an error, and
          the route continues along the source path either way.
        </p>
      )}
      {onGoToSlice && (
        <p className={styles.revisitControls}>
          <button onClick={() => onGoToSlice(division.parentSlice)}>
            Go to the parent slice {division.parentSlice}
          </button>
          {division.daughters.map((d) => (
            <button key={d.label} onClick={() => onGoToSlice(d.slice)}>
              Go to {d.label} · slice {d.slice}
            </button>
          ))}
        </p>
      )}
    </div>
  )
}
