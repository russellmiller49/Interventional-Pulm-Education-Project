'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import { CAPSTONE_MIN_HELD, capstoneItemId, imagingCases } from '../content/cases'
import { imagingSectionLinkTarget } from '../content/pathwayResolver'
import { peripheralImagingPathwaySections } from '../content/pathway'
import { capstoneStandard, capstoneUnlocked } from '../engine/caseStandard'
import {
  readImagingRecord,
  withCapstoneDebriefViewed,
  withFirstAttempt,
  writeImagingRecord,
} from '../engine/learnProgress'
import { usePeripheralImagingRecord } from './usePeripheralImagingRecord'
import styles from './stage/imaging-stage.module.css'

const COUNT_WORDS = [
  'none',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
] as const

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

/**
 * The capstone: the eight suite cases, decided once, in one sitting.
 *
 * Verdicts are withheld until every case is decided (the draft's separate-screen rule), first
 * decisions are immutable, and the standard is at least seven of eight held and every
 * safety-critical decision held. The capstone opens only once every section has been worked
 * through; the remaining sections are listed by name, never as a count.
 */
export function ImagingCapstone() {
  const { record, hydrated } = usePeripheralImagingRecord()
  const [pending, setPending] = useState<string | null>(null)
  const unlock = capstoneUnlocked(record)
  const standard = capstoneStandard(record)
  const nextUndecided = imagingCases.find(
    (imagingCase) => !record.firstAttempts[capstoneItemId(imagingCase.id)],
  )

  if (!hydrated) {
    return (
      <p className="text-sm text-muted-foreground" data-capstone="pending">
        Reading your record…
      </p>
    )
  }

  if (!unlock.unlocked) {
    const remaining = peripheralImagingPathwaySections.filter((section) =>
      unlock.remaining.includes(section.id),
    )
    return (
      <section
        className="grid gap-4"
        data-capstone="locked"
        aria-labelledby="capstone-locked-heading"
      >
        <h2 id="capstone-locked-heading" className="text-2xl font-bold">
          Work through the sections first
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The capstone opens once every section has been worked through. Still to do:
        </p>
        <ul className="grid gap-2 text-sm">
          {remaining.map((section) => (
            <li key={section.id}>
              <Link
                href={imagingSectionLinkTarget(section.id)}
                className="font-semibold text-primary"
              >
                {section.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (nextUndecided) {
    const item = nextUndecided.item
    const decided = standard.decided
    return (
      <section className="grid gap-4" data-capstone="deciding" data-case={nextUndecided.id}>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Case {countWord(decided + 1)} of {countWord(imagingCases.length)} ·{' '}
          {nextUndecided.presentationTitle}
        </p>
        <p className="text-sm text-muted-foreground">
          Decide each case once. The reasoning behind every decision opens together, after the last
          one.
        </p>
        <fieldset className={stageStyles.choiceList} data-prediction-choices>
          <legend>{item.stem}</legend>
          {orderChoices(item.id, item.choices).map((choice) => (
            <label
              key={choice.id}
              className={stageStyles.choice}
              data-selected={pending === choice.id}
            >
              <input
                type="radio"
                name={`capstone-${nextUndecided.id}`}
                value={choice.id}
                checked={pending === choice.id}
                onChange={() => setPending(choice.id)}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <button
            type="button"
            className={shellStyles.nowPrimary}
            disabled={!pending}
            data-now-primary
            onClick={() => {
              if (!pending) return
              writeImagingRecord(
                withFirstAttempt(readImagingRecord(), capstoneItemId(nextUndecided.id), pending),
              )
              setPending(null)
            }}
          >
            Commit this decision <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-5" data-capstone="debrief" data-standard-met={standard.met}>
      <h2 className="text-2xl font-bold">The set, decided</h2>
      <p className="text-sm leading-6" data-capstone-standard>
        {countWord(standard.held).replace(/^\w/, (c) => c.toUpperCase())} of{' '}
        {countWord(standard.total)} decisions held.{' '}
        {standard.criticalHeld === standard.criticalTotal
          ? 'Every safety-critical decision held.'
          : `${countWord(standard.criticalTotal - standard.criticalHeld).replace(/^\w/, (c) => c.toUpperCase())} safety-critical ${standard.criticalTotal - standard.criticalHeld === 1 ? 'decision' : 'decisions'} did not hold.`}{' '}
        <strong>
          {standard.met
            ? 'Capstone standard met.'
            : 'Capstone standard not yet met — read the reasoning below.'}
        </strong>
      </p>
      <p className="text-sm text-muted-foreground">
        The standard is at least {countWord(CAPSTONE_MIN_HELD)} of {countWord(standard.total)}{' '}
        decisions held, and every safety-critical decision held. First decisions stay as they were
        made.
      </p>
      <DebriefViewed />
      <ol className="grid gap-4">
        {imagingCases.map((imagingCase) => {
          const attempt = record.firstAttempts[capstoneItemId(imagingCase.id)]
          if (!attempt) return null
          return (
            <li
              key={imagingCase.id}
              className={styles.teachingCard}
              data-case={imagingCase.id}
              data-critical={imagingCase.critical}
            >
              <p className={styles.kicker}>
                {imagingCase.presentationTitle}
                {imagingCase.critical ? ' · safety-critical' : ''}
              </p>
              <AnswerVerdict
                item={imagingCase.item}
                choiceId={attempt.choiceId}
                outcome="stated"
                timing="immediate-after-commit"
                theme="dark"
                explanationHeading="The takeaway"
              />
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function DebriefViewed() {
  const [written, setWritten] = useState(false)
  if (!written) {
    writeImagingRecord(withCapstoneDebriefViewed(readImagingRecord()))
    setWritten(true)
  }
  return null
}
