import Link from 'next/link'

import { WOLF_PREVIEW_CARDS } from './demos'
import { WolfPreviewEndForm } from './WolfPreviewChrome'
import { WOLF_PREVIEW_WORDS, wolfPreviewFileUrl, wolfPreviewPagePath } from './paths'
import styles from './wolf-preview-hub.module.css'

/**
 * The hub a signed-in reviewer lands on: one card for each thing the preview opens. Card images
 * come from the preview's own authorised file endpoint, like everything else it shows.
 */
export function WolfPreviewHub({ locale }: { locale: string }) {
  const words = WOLF_PREVIEW_WORDS
  return (
    <main className={styles.page} aria-labelledby="wolf-hub-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            {words.course} · {words.signedIn}
          </p>
          <h1 id="wolf-hub-title" className={styles.title}>
            {words.title}
          </h1>
          <p className={styles.lead}>{words.hubLead}</p>
        </div>
        <WolfPreviewEndForm locale={locale} />
      </header>

      <ul className={styles.cards}>
        {WOLF_PREVIEW_CARDS.map((card) => (
          <li key={card.item} className={styles.card}>
            {/* The bytes are session-gated, so they cannot go through the image optimiser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wolfPreviewFileUrl('hub', card.image)}
              alt={card.imageAlt}
              width={1280}
              height={674}
              className={styles.cardImage}
            />
            <div className={styles.cardBody}>
              <p className={styles.kind}>{card.kind}</p>
              <h2 className={styles.cardTitle}>
                <Link
                  href={`/${locale}${wolfPreviewPagePath(card.item)}`}
                  className={styles.cardLink}
                >
                  {card.title}
                </Link>
              </h2>
              <p className={styles.summary}>{card.summary}</p>
              <ul className={styles.contents}>
                {card.contents.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className={styles.open} aria-hidden="true">
                Open <span>→</span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.disclosure}>{words.hubDisclosure}</p>
    </main>
  )
}
