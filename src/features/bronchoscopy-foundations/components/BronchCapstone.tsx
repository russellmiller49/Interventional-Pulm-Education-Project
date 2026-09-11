'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import { CAPSTONE_CASES } from '../content/capstone'
import { BRONCH_SECTION_IDS, bronchSection } from '../content/pathway'
import { bronchSectionLinkTarget, workedBronchSectionIds } from '../content/pathwayResolver'
import { capstoneAttemptKey } from '../content/stageItems'
import {
  CAPSTONE_MIN_HELD,
  CAPSTONE_TOTAL,
  capstoneStageItem,
  evaluateCaseStandard,
} from '../engine/caseStandard'
import {
  readBronchRecord,
  withCapstoneDebriefViewed,
  withFirstAttempt,
  writeBronchRecord,
} from '../engine/learnProgress'
import { BronchContinueCta } from './hub/BronchPathwayAccordion'
import styles from './bronchoscopy-foundations-module.module.css'
import { useBronchoscopyFoundationsRecord } from './useBronchoscopyFoundationsRecord'

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

function capitalized(value: string): string {
  return value.replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * The capstone: the eight cases, decided once each, in order.
 *
 * First decisions are immutable; each case states its reasoning as soon as it is decided, and the
 * debrief opens once the last one is. The standard is at least seven of eight held, every critical
 * decision held, and no unsafe choice committed. The capstone opens only once every section has
 * been worked through; until then the note says how many remain and offers the one door.
 */
export function BronchCapstone() {
  const { record, hydrated } = useBronchoscopyFoundationsRecord()
  const [pending, setPending] = useState<Readonly<Record<string, string>>>({})
  const worked = workedBronchSectionIds(record)
  const remaining = BRONCH_SECTION_IDS.length - worked.size
  const standard = evaluateCaseStandard(record)
  const allDecided = standard.notYet.length === 0

  if (!hydrated) {
    return (
      <p className="text-sm text-muted-foreground" data-capstone="pending">
        Reading your record…
      </p>
    )
  }

  if (remaining > 0) {
    return (
      <section
        className="grid gap-4"
        data-capstone="locked"
        data-capstone-gate={remaining}
        aria-labelledby="capstone-locked-heading"
      >
        <h2 id="capstone-locked-heading" className="text-2xl font-bold">
          Work through the sections first
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The capstone opens once every section has been worked through. {remaining} of{' '}
          {BRONCH_SECTION_IDS.length} sections remain.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <BronchContinueCta />
        </div>
      </section>
    )
  }

  return (
    <section
      className="grid gap-5"
      data-capstone={allDecided ? 'debrief' : 'deciding'}
      aria-labelledby="capstone-heading"
    >
      <h2 id="capstone-heading" className="text-2xl font-bold">
        The set, decided once
      </h2>
      <p className="text-sm text-muted-foreground">
        Decide each case once. Each one states its reasoning as soon as you commit; the standard is
        read once the last one is decided.
      </p>
      <ol className="grid gap-4">
        {CAPSTONE_CASES.map((entry, index) => {
          const stage = capstoneStageItem(entry.id)
          const item = stage.item
          const attempt = record.firstAttempts[capstoneAttemptKey(entry.id)]
          const choice = pending[entry.id] ?? null
          return (
            <li
              key={entry.id}
              className={styles.teachingCard}
              data-capstone-case={entry.id}
              data-decided={Boolean(attempt)}
              data-critical={entry.critical}
            >
              <p className={styles.kicker}>
                Case {countWord(index + 1)} of {countWord(CAPSTONE_TOTAL)} ·{' '}
                {entry.presentationTitle}
                {entry.critical ? ' · critical' : ''}
              </p>
              <p data-case-situation>{entry.situation}</p>
              {attempt ? (
                <div data-case-verdict>
                  <AnswerVerdict
                    item={item}
                    choiceId={attempt.choiceId}
                    outcome="stated"
                    timing="immediate-after-commit"
                    theme="dark"
                    explanationHeading="The takeaway"
                  />
                </div>
              ) : (
                <div className="grid gap-4">
                  <fieldset className={stageStyles.choiceList} data-prediction-choices>
                    <legend>{item.stem}</legend>
                    {orderChoices(item.id, item.choices).map((candidate) => (
                      <label
                        key={candidate.id}
                        className={stageStyles.choice}
                        data-selected={choice === candidate.id}
                      >
                        <input
                          type="radio"
                          name={`capstone-${entry.id}`}
                          value={candidate.id}
                          checked={choice === candidate.id}
                          onChange={() =>
                            setPending((current) => ({ ...current, [entry.id]: candidate.id }))
                          }
                        />
                        <span>{candidate.label}</span>
                      </label>
                    ))}
                  </fieldset>
                  <div>
                    <button
                      type="button"
                      className={shellStyles.nowPrimary}
                      disabled={!choice}
                      data-now-primary
                      onClick={() => {
                        if (!choice) return
                        writeBronchRecord(
                          withFirstAttempt(
                            readBronchRecord(),
                            capstoneAttemptKey(entry.id),
                            choice,
                          ),
                        )
                        setPending((current) => {
                          const rest = { ...current }
                          delete rest[entry.id]
                          return rest
                        })
                      }}
                    >
                      Commit this decision <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Paired with{' '}
                <Link
                  className="font-semibold text-primary"
                  href={bronchSectionLinkTarget(entry.pairedSectionId)}
                >
                  {bronchSection(entry.pairedSectionId).title}
                </Link>
                .
              </p>
            </li>
          )
        })}
      </ol>
      {allDecided ? <Debrief /> : null}
    </section>
  )
}

function Debrief() {
  const { record } = useBronchoscopyFoundationsRecord()
  const standard = evaluateCaseStandard(record)
  const titleOf = (caseId: string) =>
    CAPSTONE_CASES.find((entry) => entry.id === caseId)?.presentationTitle ?? caseId
  return (
    <section
      className="grid gap-3"
      data-capstone-debrief
      data-standard={standard.met ? 'met' : 'not-yet-met'}
      aria-labelledby="capstone-debrief-heading"
    >
      <h3 id="capstone-debrief-heading" className="text-xl font-bold">
        {standard.met ? 'Standard met' : 'Standard not yet met'}
      </h3>
      <p className="text-sm leading-6" data-capstone-standard>
        {capitalized(countWord(standard.held))} of {countWord(CAPSTONE_TOTAL)} decisions held.{' '}
        {standard.criticalMissed.length === 0
          ? 'Every critical decision held.'
          : `${capitalized(countWord(standard.criticalMissed.length))} critical ${standard.criticalMissed.length === 1 ? 'decision' : 'decisions'} did not hold.`}{' '}
        {standard.unsafeChosen.length === 0
          ? 'No unsafe choice was committed.'
          : `${capitalized(countWord(standard.unsafeChosen.length))} committed ${standard.unsafeChosen.length === 1 ? 'choice was' : 'choices were'} unsafe.`}
      </p>
      {standard.criticalMissed.length > 0 ? (
        <div className="text-sm" data-critical-missed>
          <p className="font-semibold">Critical decisions that did not hold</p>
          <ul className="mt-1 list-disc pl-5">
            {standard.criticalMissed.map((caseId) => (
              <li key={caseId} data-case={caseId}>
                {titleOf(caseId)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {standard.unsafeChosen.length > 0 ? (
        <div className="text-sm" data-unsafe-chosen>
          <p className="font-semibold">Unsafe choices</p>
          <ul className="mt-1 list-disc pl-5">
            {standard.unsafeChosen.map((caseId) => (
              <li key={caseId} data-case={caseId}>
                {titleOf(caseId)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        The standard is at least {countWord(CAPSTONE_MIN_HELD)} of {countWord(CAPSTONE_TOTAL)}{' '}
        decisions held, every critical decision held, and no unsafe choice committed. First
        decisions stay as they were made; the reasoning above is there to read again.
      </p>
      <DebriefViewed />
    </section>
  )
}

function DebriefViewed() {
  const [written, setWritten] = useState(false)
  if (!written) {
    writeBronchRecord(withCapstoneDebriefViewed(readBronchRecord()))
    setWritten(true)
  }
  return null
}
