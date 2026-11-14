'use client'

import { ClipboardList } from 'lucide-react'

import { Link } from '@/i18n/navigation'

import { DOLPHIN_DECISIONS } from '../../content/decisions'
import { DOLPHIN_INTEGRATED_CASES } from '../../content/integratedCases'
import { dolphinIntegratedCaseLinkTarget } from '../../content/routes'
import styles from '../dolphin-hub.module.css'
import { useDolphinProgress } from '../useDolphinProgress'

/** The integrated cases, every one open. This device remembers only which were opened. */
export function DolphinIntegratedCasesLanding({ unknownCase }: { readonly unknownCase?: string }) {
  const { progress } = useDolphinProgress()
  const opened = new Set(progress.openedIntegratedCaseIds)
  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 sm:px-6 lg:px-8">
      {unknownCase ? (
        <p className="rounded-2xl border p-4 text-sm" role="status" data-unknown-case={unknownCase}>
          That case is not here. Every case is listed below.
        </p>
      ) : null}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Integrated cases</p>
      <h1 className="text-3xl font-bold tracking-tight">Whole procedures, frame by frame</h1>
      <p>
        Each case follows one dolphin through several decisions. You see whether each choice holds
        as you make it; the debrief — what the case turned on, your first choices, the first moves
        and the sources — opens after the last frame. Your choices stay on the page and are not
        saved.
      </p>
      <ul className="grid gap-3" data-integrated-cases>
        {DOLPHIN_INTEGRATED_CASES.map((integrated) => {
          const decision = DOLPHIN_DECISIONS.find((d) => d.id === integrated.decisionId)
          return (
            <li key={integrated.id}>
              <Link
                className={styles.chip}
                data-kind="integrated-case"
                data-visited={opened.has(integrated.id)}
                href={dolphinIntegratedCaseLinkTarget(integrated.id)}
              >
                <ClipboardList aria-hidden="true" />
                {integrated.title}
                <small>
                  {' '}
                  · {integrated.frames.length} frames · {decision?.title}
                  {opened.has(integrated.id) ? ' · opened' : ''}
                </small>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
