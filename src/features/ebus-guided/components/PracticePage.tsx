'use client'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { LESSONS } from '../content/curriculum'
import { PRACTICE_CASES } from '../content/cases'
import { EMPTY_EBUS_OBSERVATION, type EbusObservation } from '@/lib/ebus-guided-bridge'
import { labGoalMet } from '../content/types'
import { EbusModuleFrame } from './ModuleFrame'
import { CasePlayer } from './CasePlayer'
import { Workbench } from './Workbench'
import { StationFigure } from './StationFigure'
import styles from './course.module.css'
export function PracticePage({ locale = 'en' }: { locale?: string }) {
  const [active, setActive] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [observation, setObservation] = useState<EbusObservation>(EMPTY_EBUS_OBSERVATION)
  const [reveal, setReveal] = useState(false)
  const item = PRACTICE_CASES.find((c) => c.id === active)
  const lesson = LESSONS.find((l) => l.id === active && l.lab)
  const labs = LESSONS.filter((l) => l.lab?.kind === 'knobology')
  function choose(id: string | null) {
    setActive(id)
    setReveal(false)
    setObservation(EMPTY_EBUS_OBSERVATION)
    setRound((v) => v + 1)
  }
  return (
    <EbusModuleFrame locale={locale} active="Practice">
      <div className={styles.page}>
        {item ? (
          <CasePlayer
            key={item.id + round}
            item={item}
            mode="practice"
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
              <section className={styles.card}>
                <h2>Acquisition debrief</h2>
                <p>
                  {labGoalMet(lesson.lab, observation)
                    ? 'The acquisition matches this teaching example.'
                    : 'The acquisition differs from the target for this teaching example.'}
                </p>
                <p>{lesson.worked.reasoning}</p>
                <p>{lesson.boundary}</p>
                <button className={styles.secondary} onClick={() => choose(lesson.id)}>
                  Try again
                </button>
              </section>
            ) : (
              <button
                className={styles.button}
                disabled={!observation.frameReady || observation.actionCount < 1}
                onClick={() => setReveal(true)}
              >
                Review acquisition
              </button>
            )}
          </>
        ) : (
          <>
            <p className={styles.eyebrow}>Practice · Choose a focused activity</p>
            <h1 className={styles.caseTitle}>Return to the parts that need another look.</h1>
            <p>
              Practice is optional and does not complete required lessons. Revisit these activities
              after a few days. Case feedback appears at debrief; safety feedback is immediate.
            </p>
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
              <p>
                Use the existing unrestricted EBUS tools for free exploration. Return here for the
                guided course activities.
              </p>
              <div className={styles.actions}>
                <Link className={styles.secondary} href="/ebus-training/simulator">
                  Open full EBUS simulator
                </Link>
                <Link className={styles.secondary} href="/ebus-training/knobology">
                  Open full knobology tools
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
