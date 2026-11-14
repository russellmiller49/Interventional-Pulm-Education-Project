'use client'

import { useEffect, useId, useState } from 'react'

import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import { Link } from '@/i18n/navigation'

import { dolphinSourceById } from '../../data/sources'
import { DOLPHIN_DECISIONS } from '../../content/decisions'
import { dolphinIntegratedCaseById } from '../../content/integratedCases'
import { DOLPHIN_ASSESS_HREF, dolphinSectionLinkTarget } from '../../content/routes'
import { DOLPHIN_SECTION_META } from '../../content/sectionCatalog'
import { troubleRowById } from '../../content/troubleGrammar'
import { recordDolphinLocation } from '../../engine/selfPacedProgress'
import { DolphinFrameImage } from '../stage/DolphinFrameImage'
import styles from '../stage/dolphin-stage.module.css'

const VERDICT: Readonly<Record<string, string>> = {
  best: 'Holds.',
  'reasonable-but-incomplete': 'Defensible, but not the best move here.',
  'incorrect-mechanism': 'Does not fit what is happening.',
  unsafe: 'Unsafe: this could harm the animal.',
}

/**
 * One integrated case. Each frame takes one choice and shows its verdict at once; the learner may
 * change their mind before moving on, but the first choice is what the debrief replays. The debrief
 * opens only after the last frame. First choices live in this component; nothing is stored except
 * that the case was opened.
 */
export function DolphinIntegratedCaseActivity({ caseId }: { readonly caseId: string }) {
  const integrated = dolphinIntegratedCaseById.get(caseId)
  const [index, setIndex] = useState(0)
  const [first, setFirst] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState<Record<string, string>>({})
  const [debrief, setDebrief] = useState(false)
  const name = useId()
  useEffect(() => {
    recordDolphinLocation({ kind: 'integrated-case', id: caseId })
  }, [caseId])
  if (!integrated) return null
  const frame = integrated.frames[index]
  const chosen = current[frame.id]
  const choice = frame.choices.find((candidate) => candidate.id === chosen)
  const isLast = index === integrated.frames.length - 1
  const decision = DOLPHIN_DECISIONS.find((d) => d.id === integrated.decisionId)
  const choose = (choiceId: string) => {
    setCurrent((value) => ({ ...value, [frame.id]: choiceId }))
    setFirst((value) => (value[frame.id] ? value : { ...value, [frame.id]: choiceId }))
  }

  if (debrief) {
    const rows = [
      ...new Set(integrated.frames.flatMap((f) => (f.troubleRowId ? [f.troubleRowId] : []))),
    ]
      .map((id) => troubleRowById.get(id))
      .filter((row) => row !== undefined)
    return (
      <article className={styles.steps} data-integrated-case={caseId} data-debrief>
        <p className={styles.kicker}>Debrief</p>
        <h1 className="text-2xl font-bold">{integrated.title}</h1>
        <p>{integrated.debrief}</p>
        <section className={styles.block} aria-label="Your first choices">
          <h2 className="text-base font-semibold">Your first choice at each frame</h2>
          <ol data-replay-strip>
            {integrated.frames.map((f) => {
              const picked = f.choices.find((c) => c.id === first[f.id])
              const best = f.choices.find((c) => c.plausibility === 'best')
              return (
                <li key={f.id} data-first-plausibility={picked?.plausibility ?? 'none'}>
                  <strong>{f.time}:</strong> {picked ? picked.label : 'No choice made'} —{' '}
                  {picked ? VERDICT[picked.plausibility] : ''}
                  {picked?.plausibility !== 'best' && best
                    ? ` The move that holds: ${best.label}`
                    : ''}
                </li>
              )
            })}
          </ol>
        </section>
        {decision ? (
          <section className={styles.block}>
            <h2 className="text-base font-semibold">
              The decision this case turned on: {decision.title}
            </h2>
            <p>{decision.question}</p>
          </section>
        ) : null}
        {rows.map((row) => (
          <section
            key={row.id}
            className={styles.block}
            data-role="first-moves"
            data-trouble-row={row.id}
          >
            <h2 className="text-base font-semibold">{row.change}</h2>
            <p>Earliest sign: {row.earliestSign}.</p>
            <ol>
              {row.firstMoves.map((move) => (
                <li key={move}>{move}</li>
              ))}
            </ol>
          </section>
        ))}
        <section className={styles.block}>
          <h2 className="text-base font-semibold">The sections it draws on</h2>
          <ul>
            {integrated.sectionIds.map((id) => (
              <li key={id}>
                <Link href={dolphinSectionLinkTarget(id)}>{DOLPHIN_SECTION_META[id].title}</Link>
              </li>
            ))}
          </ul>
        </section>
        <details className={styles.sources}>
          <summary>Sources</summary>
          <ul>
            {integrated.sourceIds.map((id) => (
              <li key={id}>{dolphinSourceById.get(id)?.citation ?? id}</li>
            ))}
          </ul>
        </details>
        <div className={styles.actions}>
          <Link className={styles.button} data-primary="true" href={DOLPHIN_ASSESS_HREF}>
            All integrated cases
          </Link>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.steps} data-integrated-case={caseId} data-frame-index={index}>
      <p className={styles.kicker}>
        Integrated case · Frame {index + 1} of {integrated.frames.length} · {frame.time}
      </p>
      <h1 className="text-2xl font-bold">{integrated.title}</h1>
      {index === 0 ? <p className={styles.situation}>{integrated.situation}</p> : null}
      <p className={styles.situation}>{frame.situation}</p>
      {frame.media ? (
        <DolphinFrameImage frameId={frame.media.frameId} revealed={chosen !== undefined} />
      ) : null}
      <fieldset className={styles.choices}>
        <legend className={styles.stem}>{frame.prompt}</legend>
        {orderChoices(frame.id, frame.choices).map((option) => (
          <label key={option.id} className={styles.choice}>
            <input
              type="radio"
              name={`${name}-${frame.id}`}
              value={option.id}
              checked={chosen === option.id}
              onChange={() => choose(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      {choice ? (
        <p
          className={styles.note}
          data-tone={choice.plausibility === 'best' ? 'done' : 'hint'}
          role={choice.plausibility === 'unsafe' ? 'alert' : 'status'}
          data-verdict={choice.plausibility}
        >
          <strong>{VERDICT[choice.plausibility]}</strong> {choice.rationale}
        </p>
      ) : null}
      <div className={styles.actions}>
        {isLast ? (
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            disabled={!chosen}
            onClick={() => setDebrief(true)}
            data-open-debrief
          >
            Open the debrief
          </button>
        ) : (
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            disabled={!chosen}
            onClick={() => setIndex(index + 1)}
            data-next-frame
          >
            Next frame
          </button>
        )}
      </div>
    </article>
  )
}
