'use client'

import { Pause, Play, StepForward } from 'lucide-react'

import type { AlarmPriority, ContextStripItem } from '@/features/learning-module/stage/ContextStrip'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'

import styles from './mcs-flow.module.css'

const PRIORITY_WORD: Readonly<Record<AlarmPriority, string>> = {
  none: 'No alarm',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

/**
 * The one clock on the page, at the head of the simulator.
 *
 * Run or pause the circulation, or move it one cardiac cycle, beside what the console is doing now:
 * the alarm, the device and its setting, the flow it reports and the mean pressure. It replaces the
 * "Display playback" disclosure at the foot of the task, the run line and "Run details" over the
 * Now card, and the context strip above the lesson, which were three places for one clock (the
 * mechanical ventilation module's `VentilationClockBar` made the same move, 2026-10-14). The
 * console line uses the shared context strip's styles; the alarm sits on the clock's row so the
 * bar is two lines on a laptop.
 *
 * While an earlier task is being looked at, the circulation is held and the bar says so instead of
 * drawing controls that cannot act.
 */
export function McsClockBar({
  running,
  held,
  timeSeconds,
  onToggle,
  onStepCycle,
  items,
  alarm,
}: {
  readonly running: boolean
  readonly held: boolean
  readonly timeSeconds: number
  readonly onToggle: () => void
  readonly onStepCycle: () => void
  readonly items: readonly ContextStripItem[]
  readonly alarm: { readonly priority: AlarmPriority; readonly text: string }
}) {
  return (
    <div
      className={styles.clockBar}
      data-clock-bar
      data-clock-state={held ? 'held' : running ? 'running' : 'paused'}
    >
      <div className={styles.clockTransport}>
        {held ? (
          <span className={styles.clockHeld} data-clock-held>
            Earlier task · held
          </span>
        ) : (
          <>
            <button
              type="button"
              className={styles.clockButton}
              aria-pressed={running}
              onClick={onToggle}
              data-clock-run
            >
              {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {running ? 'Pause' : 'Run'}
            </button>
            <button
              type="button"
              className={styles.clockButton}
              onClick={onStepCycle}
              data-clock-step
            >
              <StepForward aria-hidden="true" />
              One cardiac cycle
            </button>
          </>
        )}
        <span className={styles.clockTime} data-clock-time>
          <small>{held || running ? 'Time' : 'Paused at'}</small> {timeSeconds.toFixed(1)} s
        </span>
        <span
          className={`${shellStyles.alarmChip} ${styles.clockAlarm}`}
          data-alarm-priority={alarm.priority}
        >
          <span className={shellStyles.badge}>{PRIORITY_WORD[alarm.priority]}</span>
          <span>{alarm.text}</span>
        </span>
      </div>
      <div className={shellStyles.stripLine} data-context-line>
        {items.map((item) => (
          <span key={item.label} className={shellStyles.stripItem}>
            <small>{item.label}</small>
            <span>{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
