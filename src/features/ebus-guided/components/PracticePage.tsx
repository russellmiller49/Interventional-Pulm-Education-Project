'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { LESSONS } from '../content/curriculum'
import { PRACTICE_CASES } from '../content/cases'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { labGoalMet } from '../content/types'
import { recordLocation } from '../engine/selfPacedProgress'
import { EbusModuleFrame } from './ModuleFrame'
import { CasePlayer } from './CasePlayer'
import { Workbench } from './Workbench'
import { StationFigure } from './StationFigure'
import { StorageNotice } from './StorageNotice'
import { useCourseProgress } from './useCourseProgress'
import styles from './course.module.css'

/**
 * Optional practice (EBUS-01): the three practice cases, the knobology labs and the free tools.
 * A lab debrief describes the learner's actual acquisition, so it opens only after one; the
 * teaching example can be read at any time and says that it is not an acquisition.
 */
export function PracticePage({ locale = 'en' }: { locale?: string }) {
  const { progress, status } = useCourseProgress()
  const [active, setActive] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [observation, setObservation] = useState<EbusObservation>(EMPTY_EBUS_OBSERVATION)
  const [reveal, setReveal] = useState(false)
  const [example, setExample] = useState(false)
  const item = PRACTICE_CASES.find((c) => c.id === active)
  const lesson = LESSONS.find((l) => l.id === active && l.lab)
  const labs = LESSONS.filter((l) => l.lab?.kind === 'knobology')
  function choose(id: string | null) {
    setActive(id)
    setReveal(false)
    setExample(false)
    setObservation(EMPTY_EBUS_OBSERVATION)
    setRound((v) => v + 1)
    if (id && LESSONS.some((l) => l.id === id)) recordLocation({ kind: 'practice-lab', id })
  }
  const acquired = observation.frameReady && observation.actionCount >= 1
  return (
    <EbusModuleFrame
      locale={locale}
      active="Practice"
      // Selecting Practice while a case or a lab is open returns to the practice list (PR-7).
      onReselectSection={active ? () => choose(null) : undefined}
    >
      <div className={styles.page}>
        {item ? (
          <CasePlayer
            key={item.id + round}
            item={item}
            kind="practice"
            onExit={() => choose(null)}
          />
        ) : lesson?.lab ? (
          <>
            <button className={styles.secondary} onClick={() => choose(null)}>
              Back to practice
            </button>
            <h1 className={styles.caseTitle}>{lesson.title}</h1>
            <p>{lesson.lab.instruction}</p>
            <Workbench
              key={lesson.id + round}
              lab={lesson.lab}
              locked={reveal}
              reveal={reveal}
              sessionId={'practice-' + lesson.id + '-' + round}
              onObservation={setObservation}
            />
            {reveal ? (
              <section className={styles.card} data-lab-debrief>
                <h2>Acquisition debrief</h2>
                <p>
                  {labGoalMet(lesson.lab, observation)
                    ? 'Your acquisition matches this teaching example.'
                    : 'Your acquisition differs from the target for this teaching example.'}
                </p>
                <p>{lesson.worked.reasoning}</p>
                <p>{lesson.boundary}</p>
                <button className={styles.secondary} onClick={() => choose(lesson.id)}>
                  Try again
                </button>
              </section>
            ) : (
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  disabled={!acquired}
                  aria-describedby={acquired ? undefined : 'practice-lab-review-reason'}
                  onClick={() => setReveal(true)}
                >
                  Review my acquisition
                </button>
                <button
                  className={styles.secondary}
                  aria-expanded={example}
                  onClick={() => setExample((value) => !value)}
                >
                  {example ? 'Hide the teaching example' : 'Read the teaching example'}
                </button>
                {!acquired && (
                  <p id="practice-lab-review-reason" className={styles.muted}>
                    The debrief describes your own acquisition, so it opens after you have made one.
                    The teaching example is available now.
                  </p>
                )}
              </div>
            )}
            {example && !reveal && (
              <section className={styles.card} data-lab-example>
                <h2>Teaching example</h2>
                <p className={styles.muted}>
                  Shown on request. This describes the authored example; it is not your acquisition.
                </p>
                <p>{lesson.worked.context}</p>
                <p>{lesson.worked.reasoning}</p>
                <p>{lesson.boundary}</p>
              </section>
            )}
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>Practice · Choose a focused activity</p>
            <h1 className={styles.caseTitle}>Return to the parts that need another look.</h1>
            <p>
              Practice is optional. Revisit these activities after a few days. Each case explains a
              response when you check it, offers the explanation before you answer, and stores
              nothing you choose.
            </p>
            <StorageNotice status={status} />
            <section className={styles.card}>
              <h2>Station recognition and clinical cases</h2>
              <p>
                Use the CT references and described landmarks, then compare your decisions with the
                debrief.
              </p>
              <div className={styles.actions}>
                {PRACTICE_CASES.map((c) => (
                  <button key={c.id} className={styles.secondary} onClick={() => choose(c.id)}>
                    {c.title}
                    {progress.openedPracticeCaseIds.includes(c.id) ? ' · Opened' : ''}
                  </button>
                ))}
              </div>
            </section>
            <section className={styles.card}>
              <h2>Fix the image and document it</h2>
              <div className={styles.actions}>
                {labs.map((l) => (
                  <button key={l.id} className={styles.secondary} onClick={() => choose(l.id)}>
                    {l.title}
                  </button>
                ))}
              </div>
            </section>
            <section className={styles.card}>
              <h2>Explore anatomy and acquisition</h2>
              {/*
               * These two leave the guided course for the separate, older EBUS tools, which the
               * link text did not say (EBUS-PRE-REVIEW-01, PR-5). They are free exploration: no
               * lesson, no check and no course record.
               */}
              {/*
               * The destination needs a site account; this course does not (EBUS-PRE-REVIEW-04,
               * part D). `/ebus-training` is outside the public-unlisted paths in
               * `site-auth/access.ts`, so a visitor without a session is sent to sign in.
               */}
              <p>
                These open the separate EBUS training tools, outside this course. They ask you to
                sign in to the site; this course does not. They are free exploration — no lesson, no
                checks and nothing recorded here. Use the browser Back button or the course tabs
                above to return.
              </p>
              <div className={styles.actions}>
                <Link className={styles.secondary} href="/ebus-training/simulator">
                  Open the full EBUS simulator (separate tool, sign-in required)
                </Link>
                <Link className={styles.secondary} href="/ebus-training/knobology">
                  Open the full knobology tools (separate tool, sign-in required)
                </Link>
              </div>
            </section>
            <StationFigure station="7" allowSelect />
          </>
        )}
      </div>
    </EbusModuleFrame>
  )
}
