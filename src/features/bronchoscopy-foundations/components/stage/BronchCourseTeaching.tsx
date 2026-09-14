'use client'

import { useId, useState } from 'react'
import { TEACHING_TREE, airwayDisplayName } from '../../content/airwayTree'
import { scopeControl } from '../../content/controlPanel'
import { useBronchoscopyFoundationsRecord } from '../useBronchoscopyFoundationsRecord'
import { BRONCH_SECTION_IDS } from '../../content/sectionIds'
import { isSectionCompleted } from '../../engine/learnProgress'
import { MonitorPanel } from './MonitorPanel'
import { GRAMMAR_TREND_RULE, BRONCH_GRAMMAR } from '../../content/grammar'
import { fiveControlsLearnInputs } from '../../content/fiveControlsLearn'
import { isStillStructureId } from '../../content/media'
import type { BronchStageLesson, BronchStageStep } from '../../content/stageLessons'
import { BlockCard } from './BronchTeachingBlock'
import { BronchPilotTeaching } from './BronchPilotTeaching'
import { InstrumentOrientation } from './InstrumentOrientation'
import { MediaFigure } from './MediaFigure'
import styles from './course-flow.module.css'

/** Source blocks are intentionally visible during teaching, independent of any future answer. */
export function BronchCourseTeaching({
  lesson,
  step,
  hintShown = false,
}: {
  readonly lesson: BronchStageLesson
  readonly step: BronchStageStep
  readonly hintShown?: boolean
}) {
  const id = useId()
  const chunk = step.course
  if (!chunk) return null
  const { section } = lesson
  const sort = section.act.kind === 'sort' ? section.act.sort : null
  if (step.activity === 'independent-check') {
    return step.learn ? (
      <BronchPilotTeaching unit={step.learn} section={section} hintShown={hintShown} />
    ) : null
  }
  const blocks = chunk.blocks.map(
    (blockId) => section.blocks.find((block) => block.id === blockId)!,
  )
  return (
    <div className={styles.teaching} data-course-teaching>
      {step.learn ? (
        <BronchPilotTeaching unit={step.learn} section={section} hintShown={hintShown} />
      ) : null}
      {chunk.visual === 'instrument' ? (
        <div className={styles.illustratedPair}>
          <InstrumentOrientation />
          {section.id === 'pre-use-check' ? (
            <section>
              <h3>What each hand does</h3>
              {fiveControlsLearnInputs()[0].learn!.paragraphs.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
      {section.id === 'what-completion-means' && chunk.id === 'evidence' ? (
        <LearningRecordSummary />
      ) : null}
      {chunk.visual === 'shared-airway' ? <SharedAirwayFigure /> : null}
      {chunk.visual === 'tour' ? <NormalAirwayTour sectionId={section.id} /> : null}
      {chunk.visual === 'tube-geometry' ? <TubeGeometryFigure /> : null}
      {chunk.visual === 'worked-decision' ? (
        <section className={styles.worked} data-worked-example>
          <h3>A worked situation</h3>
          <p>{section.prediction.situation}</p>
        </section>
      ) : null}
      {step.learn && blocks.length ? (
        <details className={styles.worked} data-extended-technique>
          <summary>Technique reference for this concept</summary>
          {blocks.map((block, index) => (
            <BlockCard key={block.id} block={block} listId={`${id}-${index}`} role="mechanism" />
          ))}
        </details>
      ) : (
        blocks.map((block, index) => (
          <BlockCard
            key={block.id}
            block={block}
            listId={`${id}-${index}`}
            role={block.kind === 'after-commitment' ? 'mechanism' : 'framing'}
          />
        ))
      )}
      {chunk.visual === 'baseline' && section.workspace.kind === 'monitor' ? (
        <section>
          <h3>Read the channels together</h3>
          <MonitorPanel readings={section.workspace.readings} caption={section.workspace.caption} />
        </section>
      ) : null}
      {chunk.visual === 'sort-example' && section.act.kind === 'sort' ? (
        <section className={styles.worked} data-worked-example>
          <h3>A worked match</h3>
          <p>{section.act.sort.rows[0].statement}</p>
          <p>
            <strong>
              {sort?.origins.find((origin) => origin.id === sort.rows[0].origin)?.label}
            </strong>
          </p>
          <p>{section.act.sort.rows[0].rationale}</p>
          <p>Worked teaching example; no learner response is recorded.</p>
        </section>
      ) : null}
      {chunk.visual === 'sequence' && section.act.kind === 'sequence' ? (
        <section className={styles.worked} data-worked-example>
          <h3>The sequence, worked through</h3>
          <ol>
            {section.act.sequence.steps.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.label}.</strong> {entry.detail}
              </li>
            ))}
          </ol>
          <p>{section.act.sequence.rationale}</p>
        </section>
      ) : null}
      {chunk.anchor ? (
        <section className={styles.worked} data-teaching-block="anchor">
          <h3>{section.anchor.checklistLabel}</h3>
          <p data-new-concept>{section.newConcept}</p>
          <p>{section.anchor.precise}</p>
          <p>{section.anchor.analogy}</p>
          <ul>
            {section.anchor.checklist.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>
            <strong>Watch for this error.</strong> {section.harmfulReflex}
          </p>
          <p>{section.controlStrip.sentence}</p>
        </section>
      ) : null}
      {chunk.grammar && section.grammarRowIds.length > 0 ? (
        <section className={styles.worked} data-teaching-block="grammar">
          <h3>Connect the observation to the problem</h3>
          {BRONCH_GRAMMAR.filter((row) => section.grammarRowIds.includes(row.id)).map((row) => (
            <div key={row.id} data-grammar-row={row.id}>
              <h4>{row.see}</h4>
              <p>
                {row.lives}: {row.shortlist.join('; ')}.
              </p>
              <p>
                {row.verdict === 'this-control'
                  ? row.thisControl.map((control) => scopeControl(control).plainName).join(', ')
                  : row.verdict === 'no-control-retrace'
                    ? 'Stop, name the last certain landmark, retrace'
                    : row.verdict === 'no-control-stop-and-communicate'
                      ? 'Stop the provoking action, communicate, get help'
                      : 'The plan, the question or the record changes'}
              </p>
            </div>
          ))}
          <p>{GRAMMAR_TREND_RULE}</p>
        </section>
      ) : null}
      {chunk.kind === 'debrief' ? (
        <section className={styles.limit} data-teaching-block="boundary">
          <h3>What this activity can show</h3>
          <p>{section.modelBoundary}</p>
          {section.physicalSkillNote ? <p>{section.physicalSkillNote}</p> : null}
        </section>
      ) : null}
    </div>
  )
}

/** A schematic of the existing shared-airway teaching, not a patient or a physiology engine. */
function SharedAirwayFigure() {
  return (
    <figure className={styles.sharedAirway}>
      <svg
        viewBox="0 0 720 220"
        role="img"
        aria-labelledby="shared-airway-title shared-airway-desc"
      >
        <title id="shared-airway-title">
          The patient and the bronchoscopy team share one airway
        </title>
        <desc id="shared-airway-desc">
          The operator sees the airway image. The monitoring team follows the patient’s breathing
          and responsiveness. Both inform the next action.
        </desc>
        <path d="M110 108 H300 M420 108 H610" stroke="currentColor" strokeWidth="3" />
        <circle cx="360" cy="70" r="32" fill="none" stroke="currentColor" strokeWidth="3" />
        <path
          d="M295 155 Q295 110 360 110 Q425 110 425 155 M360 108 V160 M360 138 L333 165 M360 138 L387 165"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <g fill="currentColor" textAnchor="middle" fontSize="18">
          <text x="112" y="78">
            Airway image
          </text>
          <text x="606" y="78">
            Patient monitoring
          </text>
          <text x="360" y="205">
            One shared airway · a communicated plan
          </text>
        </g>
      </svg>
      <figcaption>
        Teaching schematic. Seeing a clear airway and assessing the patient are different tasks.
      </figcaption>
    </figure>
  )
}

/** Normal stills introduce names independently of the difficulty of driving the scope. */
export function NormalAirwayTour({ sectionId }: { readonly sectionId: string }) {
  const [selected, setSelected] = useState(0)
  const side = sectionId === 'left-side' ? 'left' : 'right'
  const nodes = TEACHING_TREE.filter(
    (node) =>
      node.lessonId &&
      isStillStructureId(node.lessonId) &&
      (['branch-entry', 'view-loss'].includes(sectionId)
        ? ['TR', 'RMSB', 'LMSB'].includes(node.label ?? '')
        : sectionId === 'reference-frames'
          ? ['TR', 'RMSB', 'BI'].includes(node.label ?? '')
          : node.side === side),
  )
  const node = nodes[Math.min(selected, nodes.length - 1)]
  if (!node || !isStillStructureId(node.lessonId)) return null
  const parent = TEACHING_TREE.find((entry) => entry.id === node.parentId)
  return (
    <section className={styles.tour} data-normal-airway-tour>
      <div>
        <MediaFigure
          media={{ kind: 'endoscopic-still', structureId: node.lessonId, outline: true }}
          caption={node.label ? airwayDisplayName(node.label) : node.requiredName}
        />
        <p>
          Normal teaching still; clinical/media review pending. These images are not a registered
          match to the scope model or CT study.
        </p>
      </div>
      <div>
        <label>
          Follow the normal airway tour
          <select
            aria-label="Airway in the normal tour"
            value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}
          >
            {nodes.map((entry, index) => (
              <option key={entry.id} value={index}>
                {entry.label ? airwayDisplayName(entry.label) : entry.requiredName}
              </option>
            ))}
          </select>
        </label>
        <h3>{node.label ? airwayDisplayName(node.label) : node.requiredName}</h3>
        <p>
          Parent:{' '}
          {parent?.label ? airwayDisplayName(parent.label) : (parent?.requiredName ?? 'Trachea')}.
        </p>
        <p>
          Name the parent first, then follow its daughter airway. The outline identifies the opening
          in this teaching example; later interpretation checks remove the worked tour.
        </p>
        <p>Source: S1, PDF 61–70; S2, PDF 103, 106. One declared teaching profile.</p>
      </div>
    </section>
  )
}

function TubeGeometryFigure() {
  return (
    <figure className={styles.sharedAirway}>
      <svg
        viewBox="0 0 640 240"
        role="img"
        aria-label="Schematic cross section of a scope inside a tube; space around the scope is geometric area"
      >
        <circle cx="150" cy="115" r="88" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="150" cy="115" r="55" fill="#314f59" stroke="currentColor" strokeWidth="3" />
        <path d="M206 111 H340 M212 54 H340" stroke="currentColor" strokeWidth="2" />
        <g fill="currentColor" fontSize="18">
          <text x="350" y="60">
            Space around the scope
          </text>
          <text x="350" y="117">
            Bronchoscope
          </text>
          <text x="70" y="230">
            Inside of the tube
          </text>
        </g>
      </svg>
      <figcaption>
        Schematic, not to scale. The paired views in the following exercise use the existing
        authored tube geometry. Available area alone does not predict ventilation or select a
        clinical device.
      </figcaption>
    </figure>
  )
}

function LearningRecordSummary() {
  const { record } = useBronchoscopyFoundationsRecord()
  const completed = BRONCH_SECTION_IDS.filter((id) => isSectionCompleted(record, id)).length
  const attempts = Object.entries(record.firstAttempts)
  const afterTeaching = attempts.filter(
    ([, value]) => value.support === 'learn-after-teaching',
  ).length
  const reviewed = attempts.filter(([, value]) => value.support === 'reviewed-teaching').length
  const assessments = attempts.filter(([key]) => key.startsWith('capstone:')).length
  const supported = Object.values(record.sectionPerformance).filter(
    (value) => !value.unaided || value.assistsUsed.length > 0,
  ).length
  return (
    <section className={styles.worked} data-learning-record-summary>
      <h3>Your available learning record</h3>
      <ul>
        <li>
          {completed} of {BRONCH_SECTION_IDS.length} sections have current completion evidence on
          this device.
        </li>
        <li>
          {afterTeaching} first responses followed Learn teaching; {reviewed} followed an explicit
          return to teaching during the check.
        </li>
        <li>{supported} saved scope activity records disclose assistance.</li>
        <li>
          {assessments} first capstone responses are recorded under the assessment’s
          independent-answer policy.
        </li>
      </ul>
      <p>
        Historical responses without a support label remain historical; missing labels do not
        establish independence. Repeating a question does not replace its first response. Neither
        course participation nor answer accuracy establishes physical or clinical competence.
      </p>
    </section>
  )
}
