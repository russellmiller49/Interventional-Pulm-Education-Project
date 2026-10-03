import Link from 'next/link'

import { WOLF_PREVIEW_END_ENDPOINT, WOLF_PREVIEW_WORDS, wolfPreviewPagePath } from './paths'
import styles from './wolf-preview.module.css'

/** End preview: a plain form post that clears the session cookie on the server. */
export function WolfPreviewEndForm({ locale }: { locale: string }) {
  return (
    <form method="post" action={WOLF_PREVIEW_END_ENDPOINT}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={styles.endButton}>
        {WOLF_PREVIEW_WORDS.end}
      </button>
    </form>
  )
}

/** Back to the hub from one of the pages it opens. */
export function WolfPreviewHubLink({ locale }: { locale: string }) {
  return (
    <Link href={`/${locale}${wolfPreviewPagePath()}`} className={styles.hubLink}>
      <span aria-hidden="true">←</span> {WOLF_PREVIEW_WORDS.allPreviews}
    </Link>
  )
}
