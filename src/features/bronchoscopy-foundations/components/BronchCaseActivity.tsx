'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import { LOCAL_POLICIES, LOCAL_POLICY_NOT_CONFIGURED } from '../content/localPolicies'
import { bronchMicroCaseById, bronchMicroCasesInPathwayOrder } from '../content/microCases'
import { bronchSection } from '../content/pathway'
import { bronchSectionLinkTarget } from '../content/pathwayResolver'
import { BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF, bronchCaseLinkTarget } from '../content/routes'
import styles from './bronchoscopy-foundations-module.module.css'
import { BronchExplanation } from './stage/BronchExplanation'

/**
 * One practice case: the situation, one decision, the reasoning.
 *
 * Self-paced contract (BF-01): check an answer, open the explanation before answering, try again,
 * move to another case or review the section the case draws on — in any order. Nothing is written
 * to storage. The local policies an answer depends on are named with the feedback or the
 * explanation, because the course holds no institution's numbers and never calculates for a
 * patient.
 */
export function BronchCaseActivity({ caseId }: { readonly caseId: string }) {
  const microCase = bronchMicroCaseById.get(caseId)
  const [selected, setSelected] = useState<string | null>(null)
  const [committed, setCommitted] = useState<string | null>(null)
  const [explanationOpen, setExplanationOpen] = useState(false)

  if (!microCase) {
    return (
      <p role="status" data-unknown-case={caseId}>
        That case is not in this module. Every case is listed on the Practice page.
      </p>
    )
  }

  const item = microCase.stage.item
  const order = bronchMicroCasesInPathwayOrder()
  const position = order.findIndex((entry) => entry.id === microCase.id)
  const previous = position > 0 ? order[position - 1] : null
  const next = position >= 0 && position < order.length - 1 ? order[position + 1] : null
  const section = bronchSection(microCase.sectionId)
  const policies = LOCAL_POLICIES.filter((policy) =>
    microCase.stage.localPolicyIds.includes(policy.id),
  )

  return (
    <article className="grid gap-5" data-practice-case={microCase.id}>
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Practice · case {position + 1} of {order.length}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{microCase.presentationTitle}</h1>
      </div>

      <section className={styles.teachingCard} data-case-situation>
        <p className={styles.kicker}>The situation</p>
        <p>{microCase.situation}</p>
      </section>

      {committed ? (
        <div className="grid gap-4" data-case-verdict>
          <AnswerVerdict
            item={item}
            choiceId={committed}
            outcome="stated"
            timing="immediate-after-commit"
            theme="dark"
            explanationHeading="The takeaway"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-answer-again
              onClick={() => {
                setCommitted(null)
                setSelected(null)
              }}
            >
              <RotateCcw aria-hidden="true" /> Try again
            </button>
            {next ? (
              <Link
                className={shellStyles.nowPrimary}
                href={bronchCaseLinkTarget(next.id)}
                data-next-case={next.id}
              >
                Next case <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <Link
                className={shellStyles.nowPrimary}
                href={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}
              >
                Back to the case list <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <fieldset className={stageStyles.choiceList} data-prediction-choices>
            <legend>{item.stem}</legend>
            {orderChoices(item.id, item.choices).map((choice) => (
              <label
                key={choice.id}
                className={stageStyles.choice}
                data-selected={selected === choice.id}
              >
                <input
                  type="radio"
                  name={`practice-${microCase.id}`}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() => setSelected(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={shellStyles.nowPrimary}
              data-now-primary
              disabled={!selected}
              onClick={() => {
                if (selected) setCommitted(selected)
              }}
            >
              Check my answer <ArrowRight aria-hidden="true" />
            </button>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-show-explanation
              aria-expanded={explanationOpen}
              onClick={() => setExplanationOpen((open) => !open)}
            >
              {explanationOpen ? 'Hide the explanation' : 'Show the explanation'}
            </button>
          </div>
          {explanationOpen ? (
            <BronchExplanation
              item={item}
              note="Opened without an answer. Nothing is recorded; you can still choose and check an answer."
            />
          ) : null}
        </div>
      )}

      {(committed || explanationOpen) && policies.length > 0 ? (
        <section className={styles.teachingCard} data-case-policies>
          <p className={styles.kicker}>Depends on local policy</p>
          <ul>
            {policies.map((policy) => (
              <li key={policy.id} data-local-policy={policy.id}>
                {policy.title}
              </li>
            ))}
          </ul>
          <p>{LOCAL_POLICY_NOT_CONFIGURED}</p>
        </section>
      ) : null}

      <p className="text-sm text-muted-foreground" data-case-pairing>
        This case uses the idea from{' '}
        <Link
          className="font-semibold text-primary"
          href={bronchSectionLinkTarget(microCase.sectionId)}
        >
          {section.title}
        </Link>
        . Review it whenever it helps.
      </p>

      <nav className="flex flex-wrap items-center gap-4 text-sm" aria-label="Practice cases">
        {previous ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={bronchCaseLinkTarget(previous.id)}
          >
            <ArrowLeft aria-hidden="true" /> {previous.presentationTitle}
          </Link>
        ) : null}
        <Link className="font-semibold text-primary" href={BRONCHOSCOPY_FOUNDATIONS_PRACTICE_HREF}>
          All cases
        </Link>
        {next ? (
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href={bronchCaseLinkTarget(next.id)}
            data-nav-next-case={next.id}
          >
            {next.presentationTitle} <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </nav>
    </article>
  )
}
