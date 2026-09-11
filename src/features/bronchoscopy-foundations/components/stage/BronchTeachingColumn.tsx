'use client'

import { useId } from 'react'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { useStageTeachingScope } from '@/features/learning-module/stage/StageTeachingScope'

import { SCOPE_CONTROL_IDS } from '../../components/scope/types'
import {
  SCOPE_CONTROL_PANEL,
  scopeControl,
  type ControlStripState,
} from '../../content/controlPanel'
import { BRONCH_GRAMMAR, GRAMMAR_TREND_RULE } from '../../content/grammar'
import { TEACHING_LANDMARKS } from '../../content/landmarks'
import { LOCAL_POLICY_BY_ID, LOCAL_POLICY_NOT_CONFIGURED } from '../../content/localPolicies'
import { spineStop } from '../../content/spine'
import type { BronchStageLesson } from '../../content/stageLessons'
import type { BronchTeachingBlock } from '../../content/types'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/**
 * The teaching pane: what a learner reads beside the simulator, foregrounded by the step.
 *
 * Before the commitment: what the section is for, the blocks that frame the question and name
 * the signals, and the airway stops the section stands at. After the commitment: the blocks that
 * waited, what the section adds, the idea in one picture, the five controls, the rows of the one
 * diagnostic table this section highlights, the policies it depends on, what the app cannot see,
 * and what the model leaves out. The scope decides which blocks are the focus; the commitment
 * decides what may be said at all. Every heading is a landmark a step can name.
 */
const STATE_WORDS: Readonly<Record<ControlStripState, string>> = {
  'this-one': 'this one',
  'not-this-one': 'not this one',
  'harmful-reflex': 'the harmful reflex',
  monitoring: 'monitoring only here',
}

function BlockCard({
  block,
  listId,
  role,
}: {
  readonly block: BronchTeachingBlock
  readonly listId: string
  readonly role: 'framing' | 'mechanism'
}) {
  return (
    <section
      className={styles.teachingCard}
      data-teaching-block={role}
      data-block-id={block.id}
      data-block-kind={block.kind}
      data-claim-class={block.claimClass}
    >
      <p className={styles.kicker}>{block.heading}</p>
      {block.body.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {block.points && block.points.length > 0 ? (
        <>
          {block.pointsLabel ? (
            <p className={styles.kicker} id={listId}>
              {block.pointsLabel}
            </p>
          ) : null}
          <ul className={styles.checklist} aria-labelledby={block.pointsLabel ? listId : undefined}>
            {block.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </>
      ) : null}
      {block.media ? <MediaFigure media={block.media} compact /> : null}
      {block.localPolicyIds && block.localPolicyIds.length > 0 ? (
        <p className={styles.figureCaption} data-block-policies>
          Depends on local policy:{' '}
          {block.localPolicyIds.map((id) => LOCAL_POLICY_BY_ID.get(id)?.title ?? id).join(', ')}.{' '}
          {LOCAL_POLICY_NOT_CONFIGURED}
        </p>
      ) : null}
    </section>
  )
}

export function BronchTeachingColumn({ lesson }: { readonly lesson: BronchStageLesson }) {
  const scope = useStageTeachingScope()
  const idBase = useId()
  const committed = scope?.predictionCommitted ?? true
  const { section } = lesson
  const rows = BRONCH_GRAMMAR.filter((row) => section.grammarRowIds.includes(row.id))
  const preCommit = section.blocks.filter(
    (block) => block.kind !== 'after-commitment' && block.kind !== 'boundary',
  )
  const postCommit = section.blocks.filter(
    (block) => block.kind === 'after-commitment' || block.kind === 'boundary',
  )
  const introducesPanel = section.id === 'five-controls'
  const policies = section.localPolicyIds.map((id) => LOCAL_POLICY_BY_ID.get(id)).filter(Boolean)
  // A spine stop is registry content: before the commitment it is shown only where none of the
  // section's own deny phrases appear in it, so the spine cannot hand over the section's answer.
  const spineStopsToShow = section.spineStops.filter((stopId) => {
    if (committed) return true
    const stop = spineStop(stopId)
    const text = [
      stop.title,
      stop.precise,
      stop.analogy,
      stop.checklistLabel,
      ...stop.checklist,
    ].join(' ')
    return !section.precommitDenyPatterns.some((pattern) => pattern.test(text))
  })

  return (
    <div className={styles.teaching} data-teaching-panel>
      <StageBlock kind="question" heading={TEACHING_LANDMARKS.purpose}>
        <section className={styles.teachingCard} data-teaching-block="purpose">
          <p className={styles.kicker}>{TEACHING_LANDMARKS.purpose}</p>
          <p>{section.objective}</p>
          <p>
            <strong>At the bedside.</strong> {section.why}
          </p>
          <p data-clinical-question>
            <strong>The decision.</strong> {section.clinicalQuestion}
          </p>
        </section>
      </StageBlock>

      {preCommit.map((block, index) => (
        <StageBlock
          key={block.id}
          kind={block.kind === 'question' ? 'signals' : block.kind}
          heading={block.heading}
        >
          <BlockCard block={block} listId={`${idBase}-block-${index}`} role="framing" />
        </StageBlock>
      ))}

      {spineStopsToShow.length > 0 ? (
        <StageBlock kind="pattern" heading="The airway spine">
          {spineStopsToShow.map((stopId) => {
            const stop = spineStop(stopId)
            return (
              <section
                key={stopId}
                className={styles.teachingCard}
                data-teaching-block="spine-stop"
                data-spine-stop={stopId}
                aria-label={stop.title}
              >
                <p className={styles.kicker}>{stop.title}</p>
                <p>{stop.precise}</p>
                <p className={styles.analogy}>{stop.analogy}</p>
                <p className={styles.kicker} id={`${idBase}-${stopId}`}>
                  {stop.checklistLabel}
                </p>
                <ul className={styles.checklist} aria-labelledby={`${idBase}-${stopId}`}>
                  {stop.checklist.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )
          })}
        </StageBlock>
      ) : null}

      {committed ? (
        <>
          {postCommit
            .filter((block) => block.kind === 'after-commitment')
            .map((block, index) => (
              <StageBlock key={block.id} kind="after-commitment" heading={block.heading}>
                <BlockCard block={block} listId={`${idBase}-after-${index}`} role="mechanism" />
              </StageBlock>
            ))}

          <StageBlock kind="after-commitment" heading={TEACHING_LANDMARKS.adds}>
            <section className={styles.teachingCard} data-teaching-block="adds">
              <p className={styles.kicker}>{TEACHING_LANDMARKS.adds}</p>
              <div className={styles.increment}>
                <p data-increment-sentence>{section.incrementSentence}</p>
              </div>
              <p data-new-concept>
                <strong>One new idea.</strong> {section.newConcept}
              </p>
              <p data-harmful-reflex>
                <strong>The tempting wrong move.</strong> {section.harmfulReflex}
              </p>
            </section>
          </StageBlock>

          <StageBlock kind="after-commitment" heading={TEACHING_LANDMARKS.anchor}>
            <section className={styles.teachingCard} data-teaching-block="anchor">
              <p className={styles.kicker}>{TEACHING_LANDMARKS.anchor}</p>
              <p className={styles.analogy}>{section.anchor.analogy}</p>
              <p>{section.anchor.precise}</p>
              <p className={styles.kicker} id={`${idBase}-anchor`}>
                {section.anchor.checklistLabel}
              </p>
              <ul className={styles.checklist} aria-labelledby={`${idBase}-anchor`}>
                {section.anchor.checklist.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </StageBlock>

          <StageBlock kind="after-commitment" heading={TEACHING_LANDMARKS.strip}>
            <section className={styles.teachingCard} data-teaching-block="control-strip">
              <p className={styles.kicker}>{TEACHING_LANDMARKS.strip}</p>
              {introducesPanel ? (
                <>
                  <p>{SCOPE_CONTROL_PANEL.sentence}</p>
                  <ul className={styles.checklist}>
                    {SCOPE_CONTROL_PANEL.controls.map((control) => (
                      <li key={control.id}>
                        <strong>{control.plainName}.</strong> Changes {control.changes} Does not
                        change {control.doesNotChange}
                      </li>
                    ))}
                  </ul>
                  {SCOPE_CONTROL_PANEL.monitoring.map((item) => (
                    <p key={item.id}>
                      <strong>{item.plainName}.</strong> {item.sentence}
                    </p>
                  ))}
                </>
              ) : null}
              <ul className={styles.controlStrip} data-control-strip={section.controlStrip.verdict}>
                {SCOPE_CONTROL_IDS.map((controlId) => (
                  <li
                    key={controlId}
                    data-control={controlId}
                    data-state={section.controlStrip.states[controlId]}
                  >
                    <span>{scopeControl(controlId).plainName}</span>
                    <strong>{STATE_WORDS[section.controlStrip.states[controlId]]}</strong>
                  </li>
                ))}
              </ul>
              <p data-control-strip-sentence>{section.controlStrip.sentence}</p>
            </section>
          </StageBlock>

          {rows.length > 0 ? (
            <StageBlock kind="after-commitment" heading={TEACHING_LANDMARKS.grammar}>
              <section className={styles.teachingCard} data-teaching-block="grammar">
                <p className={styles.kicker}>{TEACHING_LANDMARKS.grammar}</p>
                <table className={styles.grammarTable}>
                  <thead>
                    <tr>
                      <th scope="col">What you see</th>
                      <th scope="col">Where the problem lives</th>
                      <th scope="col">The shortlist</th>
                      <th scope="col">Which control, if any</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} data-grammar-row={row.id}>
                        <th scope="row">{row.see}</th>
                        <td>{row.lives}</td>
                        <td>{row.shortlist.join(' · ')}</td>
                        <td>
                          {row.verdict === 'this-control'
                            ? row.thisControl.map((id) => scopeControl(id).plainName).join(', ')
                            : row.verdict === 'no-control-retrace'
                              ? 'None: stop, name the last certain landmark, retrace'
                              : row.verdict === 'no-control-stop-and-communicate'
                                ? 'None: stop the provoking action, communicate, get help'
                                : 'None: the plan, the question or the record changes'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.trendRule}>{GRAMMAR_TREND_RULE}</p>
              </section>
            </StageBlock>
          ) : null}

          {policies.length > 0 ? (
            <StageBlock kind="after-commitment" heading="Depends on local policy">
              <section className={styles.teachingCard} data-teaching-block="policies">
                <p className={styles.kicker}>Depends on local policy</p>
                <ul className={styles.policies}>
                  {policies.map((policy) => (
                    <li key={policy!.id} data-local-policy={policy!.id}>
                      <strong>{policy!.title}.</strong> {policy!.description}
                    </li>
                  ))}
                </ul>
                <p className={styles.trendRule}>{LOCAL_POLICY_NOT_CONFIGURED}</p>
              </section>
            </StageBlock>
          ) : null}

          {postCommit
            .filter((block) => block.kind === 'boundary')
            .map((block, index) => (
              <StageBlock key={block.id} kind="boundary" heading={block.heading}>
                <BlockCard block={block} listId={`${idBase}-boundary-${index}`} role="mechanism" />
              </StageBlock>
            ))}

          {section.physicalSkillNote ? (
            <StageBlock kind="boundary" heading="What the app cannot see">
              <section className={styles.teachingCard} data-teaching-block="physical-skill">
                <p className={styles.kicker}>What the app cannot see</p>
                <p>{section.physicalSkillNote}</p>
              </section>
            </StageBlock>
          ) : null}

          <StageBlock kind="boundary" heading={TEACHING_LANDMARKS.boundary}>
            <section className={styles.teachingCard} data-teaching-block="boundary">
              <p className={styles.kicker}>{TEACHING_LANDMARKS.boundary}</p>
              <p>{section.modelBoundary}</p>
            </section>
          </StageBlock>
        </>
      ) : (
        <p className={styles.readBefore} data-read-before-you-decide>
          The mechanism, the idea in one picture, the five controls, the rows of the table and what
          the model leaves out open once you have committed.
        </p>
      )}
    </div>
  )
}
