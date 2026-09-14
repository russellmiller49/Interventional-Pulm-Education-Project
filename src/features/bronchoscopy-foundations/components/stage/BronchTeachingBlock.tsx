import { LOCAL_POLICY_BY_ID, LOCAL_POLICY_NOT_CONFIGURED } from '../../content/localPolicies'
import type { BronchTeachingBlock } from '../../content/types'
import styles from './bronch-stage.module.css'
import { MediaFigure } from './MediaFigure'

/** A source-backed block without phase-based disclosure. The course activity owns visibility. */
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
