'use client'

import { StageBlock } from '@/features/learning-module/stage/StageBlock'
import { teachingNumberCitationLine } from '@/features/learning-module/numbers/teachingNumbers'

import { dolphinSourceById, dolphinSourceLabel } from '../../data/sources'
import { DOLPHIN_NUMBERS } from '../../content/teachingNumbers'
import type {
  DolphinSectionDefinition,
  DolphinTeachingBlock,
  FirstMoveCard,
} from '../../content/types'
import { DolphinFrameImage } from './DolphinFrameImage'
import styles from './dolphin-stage.module.css'

function Paragraphs({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  )
}

export function TeachingBlockCard({
  block,
  revealed,
}: {
  readonly block: DolphinTeachingBlock
  readonly revealed: boolean
}) {
  return (
    <StageBlock kind={block.kind} heading={block.heading}>
      <article className={styles.block} data-role={block.role} data-block={block.id}>
        <h3>{block.heading}</h3>
        <Paragraphs text={block.body} />
        {block.points ? (
          <ul>
            {block.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
        {block.media ? (
          <DolphinFrameImage frameId={block.media.frameId} revealed={revealed} />
        ) : null}
      </article>
    </StageBlock>
  )
}

export function FirstMoveCardView({ card }: { readonly card: FirstMoveCard }) {
  return (
    <article className={styles.block} data-role="first-moves" data-first-move={card.id}>
      <h3>{card.heading}</h3>
      <ol>
        {card.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p>
        <strong>Call for help:</strong> {card.callForHelp}
      </p>
    </article>
  )
}

/** The numbers the section states, each with its source line. */
export function SectionNumbers({ numberIds }: { readonly numberIds: readonly string[] }) {
  const rows = DOLPHIN_NUMBERS.rows.filter((row) => numberIds.includes(row.id))
  if (rows.length === 0) return null
  return (
    <details data-section-numbers>
      <summary>Numbers in this section and where they come from</summary>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <strong>{row.label}:</strong> {row.value}.{' '}
            <span className={styles.sources}>
              {teachingNumberCitationLine(row, dolphinSourceLabel)}
              {row.note ? ` ${row.note}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function SectionSources({ sourceIds }: { readonly sourceIds: readonly string[] }) {
  const unique = [...new Set(sourceIds)]
  return (
    <details className={styles.sources} data-section-sources>
      <summary>Sources for this section ({unique.length})</summary>
      <ul>
        {unique.map((id) => (
          <li key={id}>{dolphinSourceById.get(id)?.citation ?? id}</li>
        ))}
      </ul>
    </details>
  )
}

export function sectionNumberIds(section: DolphinSectionDefinition): readonly string[] {
  return [
    ...new Set([
      ...section.blocks.flatMap((block) => block.numberIds ?? []),
      ...(section.prediction.numberIds ?? []),
      ...(section.transfer.numberIds ?? []),
      ...(section.act.kind === 'sort' ? (section.act.sort.numberIds ?? []) : []),
      ...(section.act.kind === 'sequence' ? (section.act.sequence.numberIds ?? []) : []),
    ]),
  ]
}

export function sectionSourceIds(section: DolphinSectionDefinition): readonly string[] {
  return [
    ...section.sourceIds,
    ...section.blocks.flatMap((block) => block.sourceIds),
    ...section.prediction.sourceIds,
    ...section.transfer.sourceIds,
  ]
}

/**
 * The Teaching panel. Before the prediction: the question and the signals. At Explain: the one
 * idea, the memory hook, the teaching that answers the prediction, and the first-move cards. The
 * shared stage scope decides what is the focus; nothing that answers the prediction renders before
 * it is committed or the learner moves past it.
 */
export function DolphinTeachingColumn({
  section,
  revealed,
}: {
  readonly section: DolphinSectionDefinition
  /** The prediction is committed or the learner has reached Explain. */
  readonly revealed: boolean
}) {
  return (
    <div className={styles.teaching} data-teaching-column>
      {section.blocks
        .filter((block) => block.kind !== 'after-commitment' || revealed)
        .map((block) => (
          <TeachingBlockCard key={block.id} block={block} revealed={revealed} />
        ))}
      {revealed ? (
        <StageBlock kind="after-commitment" heading="The one idea">
          <section className={styles.anchor} data-landmark="The one idea" data-anchor>
            <h3>The one idea</h3>
            <p>{section.newConcept}</p>
            {section.incrementSentence ? <p>{section.incrementSentence}</p> : null}
            <blockquote>{section.anchor.analogy}</blockquote>
            <p>{section.anchor.precise}</p>
            <p>
              <strong>{section.anchor.checklistLabel}</strong>
            </p>
            <ul>
              {section.anchor.checklist.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </StageBlock>
      ) : null}
      {revealed && section.firstMoves?.length ? (
        <StageBlock kind="after-commitment" heading="First moves">
          {section.firstMoves.map((card) => (
            <FirstMoveCardView key={card.id} card={card} />
          ))}
        </StageBlock>
      ) : null}
      {/* The register's labels name the anatomy a prediction may ask about, so the list waits. */}
      {revealed ? <SectionNumbers numberIds={sectionNumberIds(section)} /> : null}
      <SectionSources sourceIds={sectionSourceIds(section)} />
    </div>
  )
}
