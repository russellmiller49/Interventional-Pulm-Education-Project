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
import { ReadingTheViewTable } from '../ReadingTheViewTable'
import { BlockCard } from './BronchTeachingBlock'
import { PartReference } from './BronchIdentifyControl'
import { LocalPolicyNote } from '../LocalPolicyNote'
import { ReferenceLink } from '../ReferenceLink'
import { bronchSection } from '../../content/pathway'
import type { LocalPolicyId } from '../../content/localPolicies'
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
  // One part, one statement that no local policy was supplied (A14): each block still names the
  // policies it depends on, and the statement follows the part's blocks once.
  const policyBlocks = blocks.filter((block) => (block.localPolicyIds?.length ?? 0) > 0)
  const partPolicyIds: readonly LocalPolicyId[] =
    policyBlocks.length > 1
      ? [...new Set(policyBlocks.flatMap((block) => block.localPolicyIds ?? []))]
      : []
  const blockPolicyNote = partPolicyIds.length > 0 ? 'short' : 'full'
  // The workspace beside this teaching already shows the section's image on a `section` part; a
  // block carrying the identical image would print it twice on one screen (SUP-14).
  const workspaceMedia =
    chunk.visual === 'section' && section.workspace.kind === 'media' ? section.workspace.media : []
  const duplicatesWorkspace = (block: (typeof blocks)[number]) =>
    block.media !== undefined &&
    workspaceMedia.some((media) => JSON.stringify(media) === JSON.stringify(block.media))
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
      {chunk.visual === 'instrument' && section.act.kind === 'identify' ? (
        <section data-part-names-first-use>
          <h3>The parts named in this section</h3>
          <p>
            These are the names used for the rest of this section, each with where the part is and
            what it does. The drawing’s “suction control” is the suction valve in this list. The
            list stays available beside the photographs later.
          </p>
          <PartReference
            identify={section.act.identify}
            open
            summary="Part, where it is and what it does"
          />
        </section>
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
            <BlockCard
              key={block.id}
              block={block}
              listId={`${id}-${index}`}
              role="mechanism"
              policyNote={blockPolicyNote}
            />
          ))}
        </details>
      ) : (
        blocks.map((block, index) => (
          <BlockCard
            key={block.id}
            block={block}
            listId={`${id}-${index}`}
            role={block.kind === 'after-commitment' ? 'mechanism' : 'framing'}
            policyNote={blockPolicyNote}
            hideMedia={duplicatesWorkspace(block)}
          />
        ))
      )}
      <LocalPolicyNote ids={partPolicyIds} className={styles.limit} marker="part" />
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
          <p data-five-controls-reference>
            <ReferenceLink anchor="five-controls">
              The five controls, listed in the Reference
            </ReferenceLink>
          </p>
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

/** Sections whose tour repeats the one `branch-entry` introduced (SUP-12): labelled a refresher. */
const TOUR_REFRESHER_SECTIONS: readonly string[] = ['reference-frames', 'view-loss']

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
 * and any still opened at full size. Each still keeps its own registered outline. The stills carry
 * no orientation or camera-roll record, and the tour says so rather than labelling a wall.
 */
export function NormalAirwayTour({ sectionId }: { readonly sectionId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const headingId = useId()
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
        <p>
          Normal teaching still; clinical/media review pending. These images are not a registered
          match to the scope model or CT study.
        </p>
        <p data-tour-frame>
          Frame not recorded: these stills carry no orientation or camera-roll information, so this
          page does not say which wall of an image is anterior.
        </p>
      </div>
      <div>
        <h3 id={headingId}>Follow the normal airway tour</h3>
        {TOUR_REFRESHER_SECTIONS.includes(sectionId) ? (
          <p data-refresher-note>
            Refresher: this tour was introduced in “{bronchSection('branch-entry').title}”. It is
            repeated here, with this section’s airways, so the section stands on its own.
          </p>
        ) : null}
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
        <li data-record-reviewed>
          {record.reviewedSectionIds.length} marked reviewed. The course sets this mark when you
          reach the end of a section, whether or not you answered anything; you can undo it there.
        </li>
        <li data-record-review-later>
          {record.reviewLaterSectionIds.length} marked to review later. This mark is set only by
          you.
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
