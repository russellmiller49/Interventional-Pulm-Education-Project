'use client'

import { useState } from 'react'

import { Link } from '@/i18n/navigation'
import { IMAGE_BANK_ROWS, IMAGE_BANK_SETS, imageBankSet } from '../content/imageBank'
import {
  BRONCHOSCOPY_FOUNDATIONS_IMAGE_BANK_HREF,
  BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF,
} from '../content/routes'
import { BronchFindControl } from './stage/BronchFindControl'
import courseStyles from './stage/course-flow.module.css'

/** Where a set of the image bank opens. Sets count from 1. */
export function imageBankSetLinkTarget(set: number): {
  readonly pathname: string
  readonly query: Record<string, string>
} {
  return { pathname: BRONCHOSCOPY_FOUNDATIONS_IMAGE_BANK_HREF, query: { set: String(set) } }
}

/**
 * One set of the image bank: ten stills from both lungs, half of them rotated. The first click on
 * a picture is the answer. Nothing is kept: leaving the page or trying the set again clears it.
 */
export function BronchImageBank({ set }: { readonly set: number }) {
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({})
  const [round, setRound] = useState(0)
  const find = imageBankSet(set)
  if (!find) return null
  const total = IMAGE_BANK_SETS.length
  const finished = find.rows.every((row) => answers[row.id] !== undefined)
  const next = set < total ? set + 1 : 1
  return (
    <div className="grid gap-6" data-image-bank data-image-bank-set={set}>
      <header className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Practice · image bank
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Find the opening</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Set {set} of {total}. Ten views from both lungs, half of them rotated. Read where the
          scope is, then click the opening. Your first click is your answer, and nothing is saved.
        </p>
      </header>
      <BronchFindControl
        key={`${find.id}-${round}`}
        find={find}
        answers={answers}
        onAnswer={(rowId, markerId) =>
          setAnswers((current) =>
            current[rowId] === undefined ? { ...current, [rowId]: markerId } : current,
          )
        }
      />
      {finished ? (
        <div className="grid gap-3 border-t pt-5" role="status" data-image-bank-finished>
          <p className="leading-7">
            That is all ten in this set. The same openings come back in other sets, turned another
            way.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className={courseStyles.primary}
              href={imageBankSetLinkTarget(next)}
              data-image-bank-next={next}
            >
              {set < total ? `Set ${next} of ${total}` : 'Back to set 1'}
            </Link>
            <button
              type="button"
              className={courseStyles.secondary}
              data-image-bank-again
              onClick={() => {
                setAnswers({})
                setRound((current) => current + 1)
              }}
            >
              Try this set again
            </button>
          </div>
        </div>
      ) : null}
      <nav aria-label="Image bank sets" className="flex flex-wrap gap-4 border-t pt-5 text-sm">
        {IMAGE_BANK_SETS.map((_, index) => (
          <Link
            key={index}
            className="min-h-11 py-3 text-primary"
            href={imageBankSetLinkTarget(index + 1)}
            aria-current={index + 1 === set ? 'page' : undefined}
            data-image-bank-set-link={index + 1}
          >
            Set {index + 1}
          </Link>
        ))}
        <Link className="min-h-11 py-3 text-primary" href={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}>
          All practice
        </Link>
      </nav>
      <p className="text-sm text-muted-foreground" data-image-bank-size>
        {IMAGE_BANK_ROWS.length} questions in {total} sets.
      </p>
    </div>
  )
}
