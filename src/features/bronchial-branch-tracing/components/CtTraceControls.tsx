'use client'

import type { Course, CtBranchChoice, CtMark, CtTrace, TargetRelation } from '../content/ct-types'
import {
  COURSE_OPTIONS,
  TARGET_RELATION_OPTIONS,
  TARGET_RELATION_FEEDBACK,
} from '../content/ct-types'
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
      <h3>Your branch map</h3>
      <p className={styles.small}>
        {trace.checkpoints.filter((p) => p.decision).length} branch decisions, then the distal
        nodule approach. {recorded.filter(Boolean).length} of {trace.checkpoints.length} stops
        recorded.
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
                    : `Stop ${i + 1}: ${point.decision?.parent.airway.name ?? 'Distal nodule approach'}`
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
}: {
  trace: CtTrace
  active: number
  choice: CtBranchChoice | null
  onChange?: (value: CtBranchChoice) => void
  recorded?: boolean
  reveal?: boolean
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
  return (
    <div className={styles.branchDecision}>
      <p>
        <strong>Parent: {decision.parent.airway.code}</strong> · {decision.parent.airway.name}
      </p>
      {!recorded && (
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
                <strong>{option.label}</strong>
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
      {recorded && !reveal && (
        <p>Your recorded choice: {chosen?.label ?? 'Daughter branch unresolved'}.</p>
      )}
      {reveal && (
        <div className={styles.feedback} role="status" data-branch-comparison={point.id}>
          <strong>{recorded ? 'Junction comparison' : 'Worked junction'}</strong>
          {recorded && (
            <p>Your recorded choice: {chosen?.label ?? 'Daughter branch unresolved'}.</p>
          )}
          <p>
            The source route continues through <strong>{reference.label}</strong>.{' '}
            {decision.options.filter((o) => o.airway.code === reference.airway.code).length > 1
              ? 'These daughters share a bronchial name. Follow their separate lumens; sharing a segment name does not make them the same branch.'
              : `The other ${decision.options.length === 2 ? 'daughter leaves' : 'daughters leave'} this route at the same junction. Compare the parent and each opening on the CT and the paired airway view.`}
          </p>
          <p>
            Compare your lumen mark with the gold cross and browse the intervening slices. Next
            continues on the source route; your original response stays recorded.
          </p>
        </div>
      )}
    </div>
  )
}
export function CtJunctionTeaching({ trace, active }: { trace: CtTrace; active: number }) {
  const decision = trace.checkpoints[active].decision
  if (!decision) return null
  return (
    <section className={styles.junctionTeaching} aria-label="Current airway division">
      <h2>This junction</h2>
      <div className={styles.junctionParent}>
        {decision.parent.airway.code}
        <small>{decision.parent.airway.name}</small>
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
            <abbr title={airway.name}>{airway.code}</abbr>
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

export function CtTargetFeedback({ value }: { value: TargetRelation }) {
  return (
    <>
      <p>
        <strong>Your airway–nodule interpretation:</strong> {TARGET_RELATION_OPTIONS[value]}.
      </p>
      <p>{TARGET_RELATION_FEEDBACK[value]}</p>
    </>
  )
}
