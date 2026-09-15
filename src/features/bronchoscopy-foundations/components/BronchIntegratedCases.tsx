'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { orderChoices } from '@/features/learning-module/stage/choiceOrder'
import stageStyles from '@/features/learning-module/stage/lesson-stage.module.css'
import shellStyles from '@/features/learning-module/stage/lesson-shell.module.css'
import { Link } from '@/i18n/navigation'

import { CAPSTONE_CASES } from '../content/capstone'
import { LOCAL_POLICIES, LOCAL_POLICY_NOT_CONFIGURED } from '../content/localPolicies'
import { bronchSection } from '../content/pathway'
import { bronchSectionLinkTarget } from '../content/pathwayResolver'
import { capstoneStageItem } from '../content/stageItems'
import type { AuthoredCapstoneCase } from '../content/types'
import styles from './bronchoscopy-foundations-module.module.css'
import { BronchExplanation } from './stage/BronchExplanation'

/**
 * The integrated cases: the eight former capstone cases, each a situation that draws on several
 * sections, open to anyone at any time.
 *
 * Self-paced contract (BF-01). A case can be answered and checked, its explanation opened before
 * answering, tried again, or left for another. An unsafe choice still gets the shared immediate
 * safety feedback. There is no lock behind the Learn sections, no once-only decision, no standard
 * and no verdict on the set, and nothing is written to storage. Case ids and the activity id are
 * unchanged, so earlier records keep their meaning.
 */
export function BronchIntegratedCases() {
  return (
    <ol className="grid gap-4" data-integrated-cases>
      {CAPSTONE_CASES.map((entry, index) => (
        <IntegratedCase
          key={entry.id}
          entry={entry}
          position={index + 1}
          total={CAPSTONE_CASES.length}
        />
      ))}
    </ol>
  )
}

function IntegratedCase({
  entry,
  position,
  total,
}: {
  readonly entry: AuthoredCapstoneCase
  readonly position: number
  readonly total: number
}) {
  const stage = capstoneStageItem(entry.id)
  const { item } = stage
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState<string | null>(null)
  const [explanationOpen, setExplanationOpen] = useState(false)
  const section = bronchSection(entry.pairedSectionId)
  const policies = LOCAL_POLICIES.filter((policy) => stage.localPolicyIds.includes(policy.id))
  return (
    <li
      id={`case-${entry.id}`}
      className={styles.teachingCard}
      data-integrated-case={entry.id}
      data-safety-critical={entry.critical || undefined}
    >
      <p className={styles.kicker}>
        Case {position} of {total} · {entry.presentationTitle}
        {entry.critical ? ' · safety-critical decision' : ''}
      </p>
      <p data-case-situation>{entry.situation}</p>
      {checked ? (
        <div className="grid gap-3" data-case-verdict>
          <AnswerVerdict
            item={item}
            choiceId={checked}
            outcome="stated"
            timing="immediate-after-commit"
            theme="dark"
            explanationHeading="The takeaway"
          />
          <div>
            <button
              type="button"
              className={shellStyles.nowSecondary}
              data-answer-again
              onClick={() => {
                setChecked(null)
                setSelected(null)
              }}
            >
              <RotateCcw aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <fieldset className={stageStyles.choiceList} data-prediction-choices>
            <legend>{item.stem}</legend>
            {orderChoices(item.id, item.choices).map((candidate) => (
              <label
                key={candidate.id}
                className={stageStyles.choice}
                data-selected={selected === candidate.id}
              >
                <input
                  type="radio"
                  name={`integrated-case-${entry.id}`}
                  value={candidate.id}
                  checked={selected === candidate.id}
                  onChange={() => setSelected(candidate.id)}
                />
                <span>{candidate.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={shellStyles.nowPrimary}
              data-check-answer
              disabled={!selected}
              onClick={() => {
                if (selected) setChecked(selected)
              }}
            >
              Check my answer
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
      {(checked || explanationOpen) && policies.length > 0 ? (
        <div className="text-sm" data-case-policies>
          <p className="font-semibold">Depends on local policy</p>
          <ul className="mt-1 list-disc pl-5">
            {policies.map((policy) => (
              <li key={policy.id} data-local-policy={policy.id}>
                {policy.title}
              </li>
            ))}
          </ul>
          <p>{LOCAL_POLICY_NOT_CONFIGURED}</p>
        </div>
      ) : null}
      <p className="text-sm" data-case-pairing>
        Review this concept:{' '}
        <Link className="font-semibold text-primary" href={bronchSectionLinkTarget(section.id)}>
          {section.title}
        </Link>
        .
      </p>
    </li>
  )
}
