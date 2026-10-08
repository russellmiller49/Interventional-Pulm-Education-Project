import type { BronchTeachingBlock } from '../../content/types'
import { ConfiguredPolicies, NumberSourceNote } from '../LocalNotes'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/**
 * A teaching card. The course activity owns when it is shown. A first-move card lists its moves in
 * order and ends with when to call for help. A card that uses register numbers names their sources
 * in one line; the institution's own policy appears only when it has been configured.
 */
export function BlockCard({
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
      data-block-role={block.role}
      data-claim-class={block.claimClass}
    >
      <h3 className={styles.kicker}>{block.heading}</h3>
      {block.media ? <MediaFigure media={block.media} compact /> : null}
      {block.body.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {block.steps && block.steps.length > 0 ? (
        <ol className={styles.firstMoves} data-first-moves>
          {block.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {block.callForHelp ? (
        <p className={styles.callForHelp} data-call-for-help>
          <strong>Call for help</strong> {block.callForHelp}
        </p>
      ) : null}
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
      <NumberSourceNote ids={block.numberIds} className={styles.figureCaption} />
      <ConfiguredPolicies ids={block.localPolicyIds} className={styles.figureCaption} />
    </section>
  )
}
