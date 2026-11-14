'use client'

import { Play, RotateCcw, RotateCw } from 'lucide-react'
import { useCallback, useMemo, useReducer, useState, type ReactNode } from 'react'
import { LessonShell, NowCard, type NowCardModel } from '@/features/learning-module/stage'
import { TEACHING_SIMULATOR_STATEMENT, openingNumber } from '../content/bench-copy'
import {
  ROLL_CHOICE_DECLINED,
  ROLL_CLOSING,
  ROLL_TITLE,
  ROLL_TURN_FITS,
  ROLL_TURN_SHOWN,
  mapTurnReadout,
  rollChooseCard,
  rollDriveCard,
  rollReadyCard,
  rollStartCard,
  rollSummaryLines,
  rollTurnCard,
  rollTurnVerdict,
} from '../content/roll-copy'
import { lobeOf } from '../content/targets'
import { RIMS, modelMapLevels, type Anatomical, type Rim } from '../engine/arc-map'
import {
  MAP_TURN_STEP,
  ROLL_DRILL_FORKS,
  rollForkGeometry,
  rollReducer,
  startRollDrill,
  summarizeRoll,
} from '../engine/roll-drill'
import { falloffMmFor, routeRadiusMm } from '../geometry/airway-radius'
import { openingAnchors } from '../geometry/opening-anchors'
import {
  drivePose,
  rollPose,
  stationCamera,
  type Drive,
  type ScopePose,
} from '../geometry/route-stations'
import { AirwayTreeInset } from './AirwayTreeInset'
import { ArcMap } from './ArcMap'
import { Band } from './Band'
import { ScopeView, type ScopeOpeningLabel } from './ScopeView'
import { useDriveClock } from './useDriveClock'
import { useFillViewport } from './useFillViewport'
import { useStageFocus } from './useStageFocus'
import styles from './nav-bench.module.css'

/** The scope's speed on the drive in, and the limits on how long one drive takes. */
const DRIVE_MM_PER_SECOND = 7
const DRIVE_MS = { min: 2400, max: 5200 }
const ease = (t: number) => t * t * (3 - 2 * t)

/**
 * The bench for "The scope has rolled": the scope on the left of the pictures, the learner's map
 * beside it with its own turn buttons. The scope drives to each division with the roll applied,
 * stops with a rim that says nothing, and the learner turns the map to it and takes the opening
 * the map marks. Nothing is saved: the drill is five divisions and starts where it is opened.
 */
export function RollDrillBench({
  exit,
  next,
  onDone,
}: {
  exit: ReactNode
  /** Where the closing card leads. */
  next: { label: string; href: string }
  /** Told once, when the last division has been driven. */
  onDone?: () => void
}) {
  const [session, dispatch] = useReducer(rollReducer, null, startRollDrill)
  const { phase } = session
  const geometry = useMemo(() => rollForkGeometry(session.fork), [session.fork])
  const { trace, target, fork, frame, camera } = geometry
  const checkpoint = trace.checkpoints[geometry.checkpointIndex]
  const decision = checkpoint.decision!
  const bronchus = target.segment.bronchusCode
  const divisions = useMemo(() => modelMapLevels(trace, target, 0), [trace, target])
  const rim = useMemo(
    () => Object.fromEntries(RIMS.map((r) => [r, frame.rim[r].word])) as Record<Rim, Anatomical>,
    [frame],
  )
  const [benchRef, benchMinHeight] = useFillViewport<HTMLDivElement>()
  const stage = `roll:${session.fork}:${phase}`
  useStageFocus(benchRef, stage)

  // ── The drive in ───────────────────────────────────────────────────────────────────────────
  const from = useMemo(
    () => stationCamera(trace, geometry.fromCheckpointIndex)!,
    [trace, geometry.fromCheckpointIndex],
  )
  const drive: Drive = useMemo(
    () => ({
      fromArc: from.arc,
      from,
      toArc: camera.arc,
      to: stationCamera(trace, geometry.checkpointIndex),
    }),
    [from, camera.arc, trace, geometry.checkpointIndex],
  )
  const driveMs = Math.max(
    DRIVE_MS.min,
    Math.min(DRIVE_MS.max, (Math.abs(drive.toArc - drive.fromArc) / DRIVE_MM_PER_SECOND) * 1000),
  )
  // The drive waits for the scope's picture: a drive that ran before it was drawn was not seen.
  const [scopeReady, setScopeReady] = useState(false)
  const replays = session.log[session.fork]?.replays ?? 0
  const arrive = useCallback(() => dispatch({ type: 'arrive' }), [])
  const progress = useDriveClock(
    phase === 'drive' && scopeReady,
    `${session.fork}:${replays}`,
    driveMs,
    arrive,
  )
  const pose: ScopePose =
    phase === 'start'
      ? from
      : phase === 'drive'
        ? rollPose(
            drivePose(trace, drive, progress),
            geometry.fromRollDeg + (fork.rollDeg - geometry.fromRollDeg) * ease(progress),
          )
        : camera
  const moving = phase === 'drive'

  // ── The openings, numbered, at the division the scope has stopped at ───────────────────────
  const choosing = phase === 'choose'
  const openings: ScopeOpeningLabel[] =
    phase === 'turn' || phase === 'choose' || phase === 'ready' || phase === 'done'
      ? decision.options.map((option, index) => ({
          id: `roll:${session.fork}:${index}`,
          anchors: openingAnchors(decision.junctionLps, option.lps),
          text: openingNumber(index),
          tone:
            (phase === 'ready' || phase === 'done') && index === geometry.routeOption
              ? 'chosen'
              : session.declined.includes(index)
                ? 'declined'
                : 'plain',
          ariaLabel: `Opening ${openingNumber(index)}`,
          onPick:
            choosing && !session.declined.includes(index)
              ? () => dispatch({ type: 'choose', option: index })
              : undefined,
        }))
      : []

  // ── The task card ──────────────────────────────────────────────────────────────────────────
  const last = session.fork === ROLL_DRILL_FORKS.length - 1
  const nextRoute = !last && ROLL_DRILL_FORKS[session.fork + 1].targetId !== fork.targetId
  const divisionNumber = fork.division + 1
  // The drill counts its own stops; "division" is kept for the map's divisions.
  const count = `Stop ${session.fork + 1} of ${ROLL_DRILL_FORKS.length}`
  const summary = summarizeRoll(session)
  const now: NowCardModel =
    phase === 'start'
      ? {
          kicker: `${count} · the ostium`,
          ...rollStartCard(bronchus, session.fork === 0),
          primary: { label: 'Drive in', onActivate: () => dispatch({ type: 'drive' }) },
        }
      : phase === 'drive'
        ? { kicker: `${count} · the drive in`, ...rollDriveCard(divisionNumber) }
        : phase === 'turn'
          ? {
              kicker: `${count} · turn the map`,
              ...rollTurnCard(divisionNumber),
              primary: { label: 'Check the map', onActivate: () => dispatch({ type: 'check' }) },
              secondary: { label: 'Show me', onActivate: () => dispatch({ type: 'show-turn' }) },
            }
          : phase === 'choose'
            ? {
                kicker: `${count} · choose`,
                ...rollChooseCard(),
                secondary: {
                  label: 'Show me',
                  onActivate: () => dispatch({ type: 'show-choice' }),
                },
              }
            : phase === 'ready'
              ? {
                  kicker: `${count} · chosen`,
                  ...rollReadyCard(last, nextRoute),
                  primary: {
                    label: last ? 'Finish' : nextRoute ? 'On to the next route' : 'Drive on',
                    onActivate: () => {
                      if (last) onDone?.()
                      dispatch({ type: 'drive' })
                    },
                  },
                }
              : {
                  kicker: 'End of the drill',
                  heading: 'The map, turned to a picture that has rolled',
                  primary: { label: next.label, href: next.href },
                  pinActions: true,
                }
  const turnShown = Boolean(session.log[session.fork]?.turnShown)
  const caption =
    phase === 'start'
      ? `At the ${bronchus} ostium, looking in, as the map is drawn.`
      : phase === 'drive'
        ? `Driving to division ${divisionNumber}.`
        : `At division ${divisionNumber}, rolled. The rim gives no directions.`

  return (
    <LessonShell
      section="learn"
      stage={stage}
      label={ROLL_TITLE}
      module="bronchial-branch-tracing"
      header={
        <div className={styles.benchHeader}>
          <div className={styles.benchTitle}>
            <h1>{ROLL_TITLE}</h1>
            <p>
              A lesion in the {lobeOf(target).toLowerCase()}, by {bronchus} · its map has{' '}
              {divisions.length} divisions
            </p>
          </div>
          <ol className={styles.routeStrip} aria-label="Stops of the drill" data-route-strip>
            {ROLL_DRILL_FORKS.map((entry, index) => (
              <li
                key={`${entry.targetId}:${entry.division}`}
                data-route-chip={
                  index < session.fork || phase === 'done'
                    ? 'done'
                    : index === session.fork
                      ? 'current'
                      : 'ahead'
                }
              >
                {index + 1}
              </li>
            ))}
          </ol>
          <div className={styles.benchActions}>
            <button onClick={() => dispatch({ type: 'restart' })} data-bench-restart>
              <RotateCcw size={15} aria-hidden /> Restart the drill
            </button>
            {exit}
          </div>
        </div>
      }
    >
      <div
        ref={benchRef}
        className={styles.bench}
        style={{ height: benchMinHeight, minHeight: benchMinHeight }}
        data-bench
        data-roll-drill
        data-bench-phase={phase}
      >
        <div className={styles.now} style={{ gridArea: 'now' }}>
          <NowCard model={now}>
            {phase === 'turn' && (
              <div className={styles.rollReplay}>
                <button onClick={() => dispatch({ type: 'replay' })} data-roll-replay>
                  <Play size={15} aria-hidden /> Watch the drive in again
                </button>
              </div>
            )}
            {choosing && (
              <div className={styles.choices} role="group" aria-label="Openings">
                {decision.options.map((_, index) => {
                  const declined = session.declined.includes(index)
                  return (
                    <button
                      key={index}
                      onClick={() => dispatch({ type: 'choose', option: index })}
                      disabled={declined}
                      data-choice={openingNumber(index)}
                      data-choice-declined={declined || undefined}
                    >
                      <strong>Opening {openingNumber(index)}</strong>
                    </button>
                  )
                })}
              </div>
            )}
            {phase === 'done' && (
              <div className={styles.closing} data-bench-closing>
                {rollSummaryLines(summary).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p>{ROLL_CLOSING}</p>
                <p>{TEACHING_SIMULATOR_STATEMENT}</p>
              </div>
            )}
          </NowCard>
          <div className={styles.feedback} aria-live="polite" data-bench-feedback>
            {phase === 'turn' && session.checked && <Band {...rollTurnVerdict(session.checked)} />}
            {choosing && !session.declined.length && (
              <Band {...(turnShown ? ROLL_TURN_SHOWN : ROLL_TURN_FITS)} />
            )}
            {choosing && session.declined.length > 0 && <Band {...ROLL_CHOICE_DECLINED} />}
          </div>
        </div>

        <div className={styles.detail} style={{ gridArea: 'detail' }} data-bench-detail />

        <section className={styles.pane} style={{ gridArea: 'scope' }} aria-label="Bronchoscope">
          <header className={styles.paneHead}>
            <h2>Bronchoscope</h2>
            <span>{phase === 'start' ? `${bronchus} ostium` : `Division ${divisionNumber}`}</span>
          </header>
          <div className={styles.squareSlot}>
            <ScopeView
              position={pose.position}
              direction={pose.direction}
              up={pose.up}
              openings={openings}
              moving={moving}
              caption={caption}
              phase={phase}
              segmental={frame.side}
              plainRim={phase !== 'start'}
              onReady={setScopeReady}
              falloffMm={falloffMmFor(routeRadiusMm(trace, pose.arc))}
            />
            <AirwayTreeInset trace={trace} position={pose.position} where={bronchus} />
          </div>
          <p className={styles.paneCaption} data-scope-caption>
            {caption}
          </p>
        </section>

        <section className={styles.pane} style={{ gridArea: 'ct' }} aria-label="Your map">
          <header className={styles.paneHead}>
            <h2>Map</h2>
            <span>{bronchus} ostium</span>
          </header>
          <div className={styles.squareSlot}>
            <ArcMap
              rim={rim}
              levels={divisions}
              focus={phase === 'start' ? fork.division - 1 : fork.division}
              star
              rotation={session.mapTurn}
              label="Your map"
            />
          </div>
          <div
            className={`${styles.paneCaption} ${styles.mapTurnRow}`}
            role="group"
            aria-label="Turn the map"
            data-map-turn-row
            onKeyDown={(event) => {
              if (phase !== 'turn') return
              if (event.key === 'ArrowLeft') dispatch({ type: 'turn', degrees: -MAP_TURN_STEP })
              else if (event.key === 'ArrowRight')
                dispatch({ type: 'turn', degrees: MAP_TURN_STEP })
              else return
              event.preventDefault()
            }}
          >
            <button
              onClick={() => dispatch({ type: 'turn', degrees: -MAP_TURN_STEP })}
              disabled={phase !== 'turn'}
              data-map-turn-left
            >
              <RotateCcw size={15} aria-hidden /> Turn left
            </button>
            <button
              onClick={() => dispatch({ type: 'turn', degrees: MAP_TURN_STEP })}
              disabled={phase !== 'turn'}
              data-map-turn-right
            >
              <RotateCw size={15} aria-hidden /> Turn right
            </button>
            <span data-map-turn-readout data-map-turn-degrees={session.mapTurn}>
              {mapTurnReadout(session.mapTurn)}
            </span>
          </div>
        </section>
      </div>
    </LessonShell>
  )
}
