'use client'

import { useEffect } from 'react'

import { assertThoracoscopyCopy } from '../../content/learnerCopy'
import { landmark } from '../../content/landmarks'
import { PLEURAL_ZONE_IDS, pleuralZone } from '../../content/pleuralZones'
import type { PivotActivity, SurveyActivity, TourActivity } from '../../content/types'
import { currentTourStops } from '../../engine/space/tourStops'
import {
  surveyNoteComplete,
  type LessonAction,
  type LessonSession,
} from '../../engine/stageSession'
import {
  LEDGER_WORDS,
  ledgerWords,
  PIVOT_WORDS,
  REASON_WORDS,
  SEEN_WORDS,
} from '../space/spaceWords'
import {
  PIVOT_HAND_DIRECTIONS,
  SEEN_STATES,
  UNSEEN_REASONS,
  type SeenState,
  type UnseenReason,
} from '../space/types'
import type { SpaceEngineSession } from '../space/useSpaceEngine'
import styles from './lesson.module.css'

/**
 * The three activities of the first round's sections (`content/types.ts`), each working through the
 * space engine and never around it: the tour moves the telescope by loading each stop, a labelled
 * position, never by a simulated action; a pivot target is reached only when the engine puts its
 * region in view after the learner moved the telescope; the survey's note is the learner's own,
 * beside the engine's estimate, and neither is stored.
 */
export const ACTIVITY_WORDS = {
  tourFirst: 'Go to the first stop',
  tourNext: 'Go to the next stop',
  tourBack: 'Go back a stop',
  tourAsk: 'What tells you where you are? Name the region, or ask.',
  tourShow: 'Show me',
  tourIs: 'This is',
  tourYouNamed: 'You named',
  tourWaiting: 'The tour waits until the anatomy is ready.',
  tourUnavailable:
    'The tour is not available with this version of the anatomy, since its stops were worked out for another one.',
  tourLandmarks: 'What names it',
  pivotPredict: 'Before you move: which way will your hand go?',
  pivotMove: 'Now move the telescope with the controls below until the region is in view.',
  pivotReached: 'In view now.',
  pivotNext: 'Go to the next region',
  pivotBack: 'Go back a region',
  surveyNote: 'Your note',
  surveyRegion: 'Region',
  surveySeen: 'Seen?',
  surveyWhy: 'If not fully seen, why?',
  surveyChoose: 'Choose',
  surveyCompare: 'Compare your note with the model’s estimate',
  surveyCompareNote: 'Note every region first; the comparison waits until you have.',
  surveyModel: 'The model’s estimate',
  surveyKept: 'Your note is not kept anywhere; it is for you to compare.',
} as const

assertThoracoscopyCopy(
  Object.entries(ACTIVITY_WORDS).map(([key, text]) => ({
    where: `activity ${key}`,
    text,
    options: { allowDigits: false },
  })),
)

const ready = (space: SpaceEngineSession) => space.paneState.readiness.kind === 'ready'

/**
 * The states the learner notes, as section 11 teaches them: seen, partly seen or not seen. The
 * model's own estimate adds "seen as far as this model reaches" (OD-16), which the comparison
 * shows beside the learner's note; the section's words are not changed here.
 */
const NOTE_SEEN_STATES = SEEN_STATES.filter(
  (state): state is Exclude<SeenState, 'seen-to-reach'> => state !== 'seen-to-reach',
)

export function TourView({
  activity,
  session,
  dispatch,
  space,
}: {
  readonly activity: TourActivity
  readonly session: LessonSession
  readonly dispatch: (action: LessonAction) => void
  readonly space: SpaceEngineSession
}) {
  const stops = currentTourStops()
  if (!stops) return <p className={styles.note}>{ACTIVITY_WORDS.tourUnavailable}</p>
  const at = session.tour.stop
  const go = (index: number) => {
    const stop = stops.find((entry) => entry.zone === activity.stops[index].zone)
    if (!stop) return
    space.restart({ scenario: `tour:${stop.zone}`, lungStep: stop.lungStep, pose: stop.pose })
    dispatch({ type: 'tour-stop', stop: index })
  }
  const here = at >= 0 ? activity.stops[at] : null
  const named = at >= 0 ? session.tour.named[at] : undefined
  return (
    <div className={styles.activityWork} data-tour-stop={at}>
      <div className={styles.questionActions}>
        {at > 0 ? (
          <button
            type="button"
            className={styles.courseButton}
            onClick={() => go(at - 1)}
            disabled={!ready(space)}
          >
            {ACTIVITY_WORDS.tourBack}
          </button>
        ) : null}
        {at < activity.stops.length - 1 ? (
          <button
            type="button"
            className={styles.courseButton}
            onClick={() => go(at + 1)}
            disabled={!ready(space)}
            data-tour-next
          >
            {at < 0 ? ACTIVITY_WORDS.tourFirst : ACTIVITY_WORDS.tourNext}
          </button>
        ) : null}
        {!ready(space) ? <span className={styles.note}>{ACTIVITY_WORDS.tourWaiting}</span> : null}
      </div>
      {here ? (
        <div className={styles.stop}>
          <p className={styles.kicker}>
            Stop {at + 1} of {activity.stops.length}
          </p>
          {named === undefined ? (
            <fieldset className={styles.question}>
              <legend className={styles.stem}>{ACTIVITY_WORDS.tourAsk}</legend>
              <div className={styles.zoneChoices}>
                {PLEURAL_ZONE_IDS.map((zone) => (
                  <button
                    key={zone}
                    type="button"
                    className={styles.courseButton}
                    onClick={() => dispatch({ type: 'tour-name', stop: at, zone })}
                  >
                    {pleuralZone(zone).name}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.courseButton}
                  onClick={() => dispatch({ type: 'tour-ask', stop: at })}
                >
                  {ACTIVITY_WORDS.tourShow}
                </button>
              </div>
            </fieldset>
          ) : (
            <div role="status" className={styles.feedback}>
              <p>
                <strong>
                  {ACTIVITY_WORDS.tourIs} the {pleuralZone(here.zone).name.toLowerCase()}.
                </strong>{' '}
                {named !== 'asked' && named !== here.zone
                  ? `${ACTIVITY_WORDS.tourYouNamed} the ${pleuralZone(named).name.toLowerCase()}. `
                  : ''}
                {here.notice}
              </p>
              <p className={styles.note}>
                {ACTIVITY_WORDS.tourLandmarks}:{' '}
                {here.landmarks.map((id) => landmark(id).name).join(', ')}.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function PivotView({
  activity,
  session,
  dispatch,
  space,
  moves,
}: {
  readonly activity: PivotActivity
  readonly session: LessonSession
  readonly dispatch: (action: LessonAction) => void
  readonly space: SpaceEngineSession
  /** The learner's own moves of the telescope while this target was in hand. */
  readonly moves: number
}) {
  const index = session.pivot.target
  const target = activity.targets[index]
  const predicted = session.pivot.predicted[index]
  const reached = session.pivot.reached.includes(index)
  const inView = space.paneState.inView.includes(target.zone)
  const movedSince = moves > 0
  useEffect(() => {
    // The engine says what is in view; the lesson only notices, and only after the learner moved.
    if (predicted && !reached && movedSince && inView)
      dispatch({ type: 'pivot-reached', target: index })
  }, [predicted, reached, movedSince, inView, index, dispatch])
  return (
    <div
      className={styles.activityWork}
      data-pivot-target={target.zone}
      data-reached={reached || undefined}
    >
      <p className={styles.kicker}>
        {pleuralZone(target.zone).name} · {index + 1} of {activity.targets.length}
      </p>
      <fieldset className={styles.question}>
        <legend className={styles.stem}>{ACTIVITY_WORDS.pivotPredict}</legend>
        {PIVOT_HAND_DIRECTIONS.map((hand) => (
          <label key={hand} className={styles.choice}>
            <input
              type="radio"
              name={`pivot-prediction-${index}`}
              value={hand}
              checked={predicted === hand}
              onChange={() => dispatch({ type: 'pivot-predict', target: index, hand })}
            />
            <span>{PIVOT_WORDS[hand].replace('Hand toward', 'Toward')}</span>
          </label>
        ))}
      </fieldset>
      {predicted && !reached ? <p>{ACTIVITY_WORDS.pivotMove}</p> : null}
      <div role="status" aria-live="polite">
        {reached ? (
          <p className={styles.feedback}>
            <strong>{ACTIVITY_WORDS.pivotReached}</strong> {target.handAndTip}
          </p>
        ) : null}
      </div>
      <div className={styles.questionActions}>
        {index > 0 ? (
          <button
            type="button"
            className={styles.courseButton}
            onClick={() => dispatch({ type: 'pivot-target', target: index - 1 })}
          >
            {ACTIVITY_WORDS.pivotBack}
          </button>
        ) : null}
        {index < activity.targets.length - 1 ? (
          <button
            type="button"
            className={styles.courseButton}
            onClick={() => dispatch({ type: 'pivot-target', target: index + 1 })}
          >
            {ACTIVITY_WORDS.pivotNext}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function SurveyView({
  activity,
  session,
  dispatch,
  space,
}: {
  readonly activity: SurveyActivity
  readonly session: LessonSession
  readonly dispatch: (action: LessonAction) => void
  readonly space: SpaceEngineSession
}) {
  const note = session.survey.note
  const complete = surveyNoteComplete(session, activity.order)
  return (
    <div className={styles.activityWork} data-survey>
      <table className={styles.surveyTable}>
        <caption className={styles.subHeading}>{ACTIVITY_WORDS.surveyNote}</caption>
        <thead>
          <tr>
            <th scope="col">{ACTIVITY_WORDS.surveyRegion}</th>
            <th scope="col">{ACTIVITY_WORDS.surveySeen}</th>
            <th scope="col">{ACTIVITY_WORDS.surveyWhy}</th>
          </tr>
        </thead>
        <tbody>
          {activity.order.map((zone) => {
            const row = note[zone]
            const name = pleuralZone(zone).name
            return (
              <tr key={zone} data-note-zone={zone}>
                <th scope="row">{name}</th>
                <td>
                  <select
                    aria-label={`${ACTIVITY_WORDS.surveySeen} ${name}`}
                    value={row.seen ?? ''}
                    onChange={(event) => {
                      const seen = (event.target.value || null) as SeenState | null
                      dispatch({
                        type: 'survey-note',
                        zone,
                        row: { seen, reason: seen === 'seen' ? null : row.reason },
                      })
                    }}
                  >
                    <option value="">{ACTIVITY_WORDS.surveyChoose}</option>
                    {NOTE_SEEN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {SEEN_WORDS[state]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`${ACTIVITY_WORDS.surveyWhy} ${name}`}
                    value={row.reason ?? ''}
                    disabled={row.seen === 'seen' || row.seen === null}
                    onChange={(event) =>
                      dispatch({
                        type: 'survey-note',
                        zone,
                        row: {
                          seen: row.seen,
                          reason: (event.target.value || null) as UnseenReason | null,
                        },
                      })
                    }
                  >
                    <option value="">{ACTIVITY_WORDS.surveyChoose}</option>
                    {UNSEEN_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {REASON_WORDS[reason]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className={styles.note}>{ACTIVITY_WORDS.surveyKept}</p>
      <div className={styles.questionActions}>
        <button
          type="button"
          className={styles.courseButton}
          onClick={() => {
            if (complete) dispatch({ type: 'survey-compare' })
          }}
          aria-disabled={!complete || undefined}
          aria-describedby={complete ? undefined : 'survey-compare-note'}
          data-survey-compare
        >
          {ACTIVITY_WORDS.surveyCompare}
        </button>
        {complete ? null : (
          <span id="survey-compare-note" className={styles.note}>
            {ACTIVITY_WORDS.surveyCompareNote}
          </span>
        )}
      </div>
      {session.survey.compared && complete ? (
        <table className={styles.surveyTable} data-survey-comparison>
          <caption className={styles.subHeading}>{ACTIVITY_WORDS.surveyCompare}</caption>
          <thead>
            <tr>
              <th scope="col">{ACTIVITY_WORDS.surveyRegion}</th>
              <th scope="col">{ACTIVITY_WORDS.surveyNote}</th>
              <th scope="col">{ACTIVITY_WORDS.surveyModel}</th>
            </tr>
          </thead>
          <tbody>
            {activity.order.map((zone) => {
              const row = note[zone]
              const model = space.paneState.ledger.find((entry) => entry.zone === zone)
              return (
                <tr key={zone}>
                  <th scope="row">{pleuralZone(zone).name}</th>
                  <td>
                    {row.seen
                      ? ledgerWords({
                          zone,
                          seen: row.seen,
                          reason: row.seen === 'seen' ? null : row.reason,
                        })
                      : ''}
                  </td>
                  <td>{model ? ledgerWords(model) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
      {session.survey.compared && complete ? (
        <p className={styles.note}>{LEDGER_WORDS.caption}</p>
      ) : null}
    </div>
  )
}
