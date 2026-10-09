'use client'

import { useId, useState } from 'react'
import { TEACHING_TREE, airwayDisplayName, type TeachingTreeNode } from '../../content/airwayTree'
import { useBronchoscopyFoundationsRecord } from '../useBronchoscopyFoundationsRecord'
import { BRONCH_SECTION_IDS } from '../../content/sectionIds'
import { MonitorPanel } from './MonitorPanel'
import { GRAMMAR_TREND_RULE, BRONCH_GRAMMAR } from '../../content/grammar'
import { fiveControlsLearnInputs } from '../../content/fiveControlsLearn'
import { isStillStructureId } from '../../content/media'
import type { BronchStageLesson, BronchStageStep } from '../../content/stageLessons'
import type { TourStop } from '../../content/types'
import { ReadingTheViewTable } from '../ReadingTheViewTable'
import { BlockCard } from './BronchTeachingBlock'
import { BronchPilotTeaching } from './BronchPilotTeaching'
import { InstrumentOrientation } from './InstrumentOrientation'
import { MediaFigure } from './MediaFigure'
import styles from './course-flow.module.css'

/**
 * The teaching for one screen of a section.
 *
 * The first screen opens with the section's clinical question and its memory hook: the analogy, the
 * one precise sentence and the checklist. The closing screen repeats the checklist; it does not
 * introduce it. Cards are visible during teaching, independent of any later answer.
 */
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
  const opening = lesson.steps[0]?.id === step.id
  const rewritten = section.authoringContract === 2
  return (
    <div className={styles.teaching} data-course-teaching>
      {opening ? <SectionHook section={section} /> : null}
      {step.learn ? (
        <BronchPilotTeaching unit={step.learn} section={section} hintShown={hintShown} />
      ) : null}
      {chunk.visual === 'instrument' ? (
        <div className={styles.illustratedPair}>
          <InstrumentOrientation plain={rewritten} />
          {section.id === 'pre-use-check' && !rewritten ? (
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
      {chunk.visual === 'tour' ? (
        <NormalAirwayTour
          sectionId={section.id}
          stops={
            section.tour
              ? section.tour.filter((stop) => !chunk.tour || chunk.tour.includes(stop.airway))
              : undefined
          }
        />
      ) : null}
      {chunk.visual === 'tube-geometry' ? <TubeGeometryFigure /> : null}
      {chunk.visual === 'two-diameters' ? <TwoDiametersFigure /> : null}
      {chunk.visual === 'room-setup' ? <RoomSetupFigure /> : null}
      {chunk.visual === 'worked-decision' ? (
        <section className={styles.worked} data-worked-example>
          <h3>A worked situation</h3>
          <p>{section.prediction.situation}</p>
        </section>
      ) : null}
      {step.learn && blocks.length ? (
        // A rewritten section's bench unit shows its block as the unit's own text, in view.
        rewritten ? null : (
          <details className={styles.worked} data-extended-technique>
            <summary>Technique reference for this concept</summary>
            {blocks.map((block, index) => (
              <BlockCard key={block.id} block={block} listId={`${id}-${index}`} role="mechanism" />
            ))}
          </details>
        )
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
      {chunk.anchor && chunk.kind === 'debrief' ? (
        <section className={styles.worked} data-teaching-block="anchor">
          <h3>{section.anchor.checklistLabel}</h3>
          {rewritten ? null : (
            <>
              {section.newConcept ? <p data-new-concept>{section.newConcept}</p> : null}
              <p>{section.anchor.precise}</p>
              <p>{section.anchor.analogy}</p>
            </>
          )}
          <ul data-hook-checklist>
            {section.anchor.checklist.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>
            <strong>Watch for this error.</strong> {section.harmfulReflex}
          </p>
          {section.controlStrip ? <p>{section.controlStrip.sentence}</p> : null}
        </section>
      ) : null}
      {chunk.grammar && section.grammarRowIds.length > 0 ? (
        <section className={styles.worked} data-teaching-block="grammar">
          <h3 id={`${id}-grammar`}>Connect the observation to the problem</h3>
          <ReadingTheViewTable
            rows={BRONCH_GRAMMAR.filter((row) => section.grammarRowIds.includes(row.id))}
            labelledBy={`${id}-grammar`}
          />
          <p data-grammar-trend-rule>{GRAMMAR_TREND_RULE}</p>
        </section>
      ) : null}
      {chunk.kind === 'debrief' && section.modelBoundary ? (
        <section className={styles.limit} data-teaching-block="boundary">
          <h3>What this activity can show</h3>
          <p>{section.modelBoundary}</p>
          {section.physicalSkillNote ? <p>{section.physicalSkillNote}</p> : null}
        </section>
      ) : null}
    </div>
  )
}

/** The section's clinical question and its memory hook, on the opening screen. */
function SectionHook({ section }: { readonly section: BronchStageLesson['section'] }) {
  const { anchor } = section
  return (
    <section className={styles.hook} data-teaching-block="hook">
      <p className={styles.hookQuestion} data-clinical-question>
        {section.clinicalQuestion}
      </p>
      <p data-hook-analogy>{anchor.analogy}</p>
      <p data-hook-sentence>
        <strong>{anchor.precise}</strong>
      </p>
      <h3>{anchor.checklistLabel}</h3>
      <ol data-hook-checklist>
        {anchor.checklist.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </section>
  )
}

/** The tour's groups: the airways before the segments, then each lobe's segments. */
export function tourGroups(
  nodes: readonly TeachingTreeNode[],
): readonly { readonly title: string; readonly nodes: readonly TeachingTreeNode[] }[] {
  const SEGMENT_GROUP: Readonly<Record<TeachingTreeNode['lobe'], string>> = {
    central: 'Segments',
    RUL: 'Right upper lobe segments',
    RML: 'Right middle lobe segments',
    RLL: 'Right lower lobe segments',
    LUL: 'Left upper lobe segments',
    lingula: 'Lingular segments',
    LLL: 'Left lower lobe segments',
  }
  const groups = new Map<string, TeachingTreeNode[]>()
  for (const node of nodes) {
    const title =
      node.type === 'segmental_bronchus' ? SEGMENT_GROUP[node.lobe] : 'Airways before the segments'
    groups.set(title, [...(groups.get(title) ?? []), node])
  }
  return [...groups].map(([title, members]) => ({ title, nodes: members }))
}

function tourName(node: TeachingTreeNode): string {
  return node.label ? airwayDisplayName(node.label) : node.requiredName
}

/** What a tour button says: the segment's label with its name, or the airway's name. */
function tourButtonText(node: TeachingTreeNode): string {
  return node.type === 'segmental_bronchus' && node.label
    ? `${node.label} · ${node.requiredName}`
    : node.requiredName
}

/**
 * Normal stills introduce names independently of the difficulty of driving the scope.
 *
 * The stills are grouped the way the tree is (fellow walkthrough A29): the airways before the
 * segments, then each lobe's segments, so RB1 to RB3 or RB7 to RB10 can be compared side by side
 * and any still opened at full size. Each still keeps its own registered outline.
 *
 * A rewritten section passes its own `stops`: the stills to walk, in order, each with one line on
 * where the airway leaves its parent. The tour then shows that line under the airway's name and
 * says nothing else. Without stops it lists every still of the section's side, with the first
 * contract's notes on what the stills do not record.
 */
export function NormalAirwayTour({
  sectionId,
  stops,
}: {
  readonly sectionId: string
  readonly stops?: readonly TourStop[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const headingId = useId()
  const side = sectionId === 'left-side' ? 'left' : 'right'
  const nodes = stops
    ? stops.flatMap((stop) => {
        const found = TEACHING_TREE.find((entry) => entry.label === stop.airway)
        return found && isStillStructureId(found.lessonId) ? [found] : []
      })
    : TEACHING_TREE.filter(
        (entry) =>
          entry.lessonId &&
          isStillStructureId(entry.lessonId) &&
          (['branch-entry', 'view-loss'].includes(sectionId)
            ? ['TR', 'RMSB', 'LMSB'].includes(entry.label ?? '')
            : sectionId === 'reference-frames'
              ? ['TR', 'RMSB', 'BI'].includes(entry.label ?? '')
              : entry.side === side),
      )
  const node = nodes.find((entry) => entry.id === selectedId) ?? nodes[0]
  if (!node || !isStillStructureId(node.lessonId)) return null
  const groups = tourGroups(nodes)
  const group = groups.find((entry) => entry.nodes.includes(node))!
  const parent = TEACHING_TREE.find((entry) => entry.id === node.parentId)
  const comparing = compare && group.nodes.length > 1
  const figure = (entry: TeachingTreeNode) =>
    isStillStructureId(entry.lessonId) ? (
      <MediaFigure
        key={entry.id}
        media={{ kind: 'endoscopic-still', structureId: entry.lessonId, outline: true }}
        caption={tourName(entry)}
        alt={`Endoscopic still from the course’s normal survey at the ${tourName(entry)} stop, with that opening outlined`}
        enlargeLabel={`Enlarge the ${tourName(entry)} still`}
        dialogTitle={`${tourName(entry)}, enlarged`}
      />
    ) : null
  return (
    <section
      className={styles.tour}
      data-normal-airway-tour
      data-tour-compare={comparing ? 'true' : undefined}
    >
      <div>
        {comparing ? (
          <div className={styles.tourCompare} data-tour-compare-grid>
            {group.nodes.map(figure)}
          </div>
        ) : (
          figure(node)
        )}
        {stops ? null : (
          <>
            <p>
              Normal teaching still; clinical/media review pending. These images are not a
              registered match to the scope model or CT study.
            </p>
            <p data-tour-frame>
              Frame not recorded: these stills carry no orientation or camera-roll information, so
              this page does not say which wall of an image is anterior.
            </p>
          </>
        )}
      </div>
      <div>
        <h3 id={headingId}>
          {stops ? 'Normal airways, still by still' : 'Follow the normal airway tour'}
        </h3>
        <nav className={styles.tourNav} aria-labelledby={headingId} data-tour-nav>
          {groups.map((entry) => (
            <div key={entry.title} role="group" aria-label={entry.title} data-tour-group>
              <p>{entry.title}</p>
              <div className={styles.tourButtons}>
                {entry.nodes.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={member === node}
                    data-tour-airway={member.label ?? member.id}
                    onClick={() => setSelectedId(member.id)}
                  >
                    {tourButtonText(member)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        {group.nodes.length > 1 ? (
          <button
            type="button"
            className={styles.tourCompareToggle}
            aria-pressed={comparing}
            data-tour-compare-toggle
            onClick={() => setCompare((value) => !value)}
          >
            {comparing ? 'Show one still' : `Compare the ${group.title.toLowerCase()} side by side`}
          </button>
        ) : null}
        <h3 data-tour-current>{tourName(node)}</h3>
        <p>Parent: {parent ? tourName(parent) : 'none; the tree starts at the trachea'}.</p>
        {stops ? (
          <p className={styles.tourNote} data-tour-note>
            {stops.find((stop) => stop.airway === node.label)?.note}
          </p>
        ) : (
          <>
            <p>
              Name the parent first, then follow its daughter airway. The outline identifies the
              opening in this teaching example; later interpretation checks remove the worked tour.
            </p>
            <p>Source: S1, PDF 61–70; S2, PDF 103, 106. One declared teaching profile.</p>
          </>
        )}
      </div>
    </section>
  )
}

/** The scope in cross-section: what the outer diameter and the channel each decide. */
function TwoDiametersFigure() {
  return (
    <figure className={styles.sharedAirway} data-two-diameters>
      <svg
        viewBox="0 0 640 240"
        role="img"
        aria-label="Cross-section of a bronchoscope. The outer diameter decides fit and how much airway the scope fills. The channel inside it decides which tools pass and how well it suctions."
      >
        <circle cx="150" cy="120" r="92" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="182" cy="150" r="30" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="118" cy="88" r="16" fill="currentColor" opacity="0.35" />
        <path d="M58 120 H242" stroke="currentColor" strokeWidth="2" strokeDasharray="6 5" />
        <path d="M242 96 H330 M212 150 H330" stroke="currentColor" strokeWidth="2" />
        <path d="M118 104 V222" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <g fill="currentColor" fontSize="18">
          <text x="340" y="88">
            Outer diameter
          </text>
          <text x="340" y="110" fontSize="15" opacity="0.8">
            Fit, and how much airway it fills
          </text>
          <text x="340" y="150">
            Working channel
          </text>
          <text x="340" y="172" fontSize="15" opacity="0.8">
            Tools and suction
          </text>
          <text x="76" y="238" fontSize="15" opacity="0.8">
            Lens and light
          </text>
        </g>
      </svg>
      <figcaption>The tip of the scope, seen end on. Not to scale.</figcaption>
    </figure>
  )
}

/** The room from above: where the operator, the screen, the monitor and the assistant are. */
function RoomSetupFigure() {
  return (
    <figure className={styles.sharedAirway} data-room-setup>
      <svg
        viewBox="0 0 640 260"
        role="img"
        aria-label="The room from above. The patient lies on the bed. The operator stands at the head of the bed. The screen is at the foot, in the operator’s line of sight. The monitor and the nurse are at the patient’s side, with oxygen and suction at the head."
      >
        <rect
          x="230"
          y="60"
          width="180"
          height="130"
          rx="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle cx="262" cy="125" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M282 125 H392" stroke="currentColor" strokeWidth="3" />
        <circle cx="170" cy="125" r="20" fill="currentColor" opacity="0.35" />
        <rect x="520" y="85" width="16" height="80" fill="currentColor" />
        <path
          d="M194 125 H228 M412 125 H516"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
        <rect
          x="290"
          y="14"
          width="60"
          height="26"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle cx="320" cy="224" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
        <g fill="currentColor" fontSize="16" textAnchor="middle">
          <text x="170" y="170">
            You
          </text>
          <text x="150" y="84">
            Oxygen, suction
          </text>
          <text x="320" y="56" fontSize="14">
            Monitor
          </text>
          <text x="320" y="256">
            Nurse
          </text>
          <text x="560" y="72">
            Screen
          </text>
        </g>
      </svg>
      <figcaption>
        One layout, with you at the head of the bed. If you face the patient instead, the screen
        goes behind the patient’s head.
      </figcaption>
    </figure>
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

/** What this self-paced course keeps on the device (BF-01): marks, never answers or grades. */
function LearningRecordSummary() {
  const { record } = useBronchoscopyFoundationsRecord()
  return (
    <section className={styles.worked} data-learning-record-summary>
      <h3>What this course keeps on this device</h3>
      <ul>
        <li>
          {record.visitedSectionIds.length} of {BRONCH_SECTION_IDS.length} sections opened.
        </li>
        <li>
          {record.reviewedSectionIds.length} marked reviewed by you;{' '}
          {record.reviewLaterSectionIds.length} marked to review later.
        </li>
        <li>
          {record.surveySnapshot
            ? 'A lower-airway survey you finished, kept for the report exercise.'
            : 'No finished lower-airway survey.'}
        </li>
      </ul>
      <p>
        Answers, hints, retries and scope attempts are not saved, and nothing here is a grade.
        Records kept by an earlier version of this course stay on this device unchanged and are not
        used. Self-paced online learning does not establish procedural competence.
      </p>
    </section>
  )
}
