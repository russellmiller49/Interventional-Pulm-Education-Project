import { LocalPolicyNote } from '../LocalPolicyNote'
import type { BronchTeachingBlock } from '../../content/types'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/** A source-backed block without phase-based disclosure. The course activity owns visibility. */
export function BlockCard({
  block,
  listId,
  role,
  policyNote = 'full',
  hideMedia = false,
}: {
  readonly block: BronchTeachingBlock
  readonly listId: string
  readonly role: 'framing' | 'mechanism'
  /** `short` when the part says once, after its blocks, that no local policy was supplied. */
  readonly policyNote?: 'full' | 'short'
  /** True when the same image is already on this screen in the workspace beside the teaching. */
  readonly hideMedia?: boolean
}) {
  return (
    <section
      className={styles.teachingCard}
      data-teaching-block={role}
      data-block-id={block.id}
      data-block-kind={block.kind}
      data-claim-class={block.claimClass}
    >
      <h3 className={styles.kicker}>{block.heading}</h3>
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
      {block.media && !hideMedia ? <MediaFigure media={block.media} compact /> : null}
      <LocalPolicyNote
        ids={block.localPolicyIds ?? []}
        variant={policyNote}
        className={styles.figureCaption}
        marker="block"
      />
    </section>
  )
}
