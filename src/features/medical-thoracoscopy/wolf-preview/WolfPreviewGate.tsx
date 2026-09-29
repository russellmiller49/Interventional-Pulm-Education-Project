import { WOLF_PREVIEW_SESSION_ENDPOINT, WOLF_PREVIEW_WORDS, type ReviewState } from './paths'
import styles from './wolf-preview.module.css'

/**
 * The review-code screen. A plain form that posts to the server; nothing about the codes or the
 * reviewers is on this page, and it works without JavaScript.
 */
export function WolfPreviewGate({ locale, state }: { locale: string; state: ReviewState | null }) {
  const words = WOLF_PREVIEW_WORDS
  return (
    <main className={styles.gate}>
      <section className={styles.panel} aria-labelledby="wolf-preview-title">
        <p className={styles.course}>{words.course}</p>
        <h1 id="wolf-preview-title" className={styles.title}>
          {words.title}
        </h1>
        <p className={styles.intro}>{words.intro}</p>
        {state && (
          <p
            className={styles.message}
            data-kind={state === 'ended' ? 'info' : 'error'}
            role={state === 'ended' ? 'status' : 'alert'}
          >
            {words.messages[state]}
          </p>
        )}
        <form method="post" action={WOLF_PREVIEW_SESSION_ENDPOINT} className={styles.form}>
          <input type="hidden" name="locale" value={locale} />
          <label htmlFor="wolf-preview-code" className={styles.label}>
            {words.codeLabel}
          </label>
          <input
            id="wolf-preview-code"
            name="code"
            type="password"
            required
            autoComplete="current-password"
            spellCheck={false}
            autoCapitalize="characters"
            className={styles.input}
          />
          <button type="submit" className={styles.submit}>
            {words.open}
          </button>
        </form>
        <p className={styles.help}>{words.help}</p>
        <p className={styles.disclosure}>{words.disclosure}</p>
      </section>
    </main>
  )
}

export function WolfPreviewUnavailable() {
  return (
    <main className={styles.gate}>
      <section className={styles.panel} aria-labelledby="wolf-preview-title">
        <p className={styles.course}>{WOLF_PREVIEW_WORDS.course}</p>
        <h1 id="wolf-preview-title" className={styles.title}>
          {WOLF_PREVIEW_WORDS.title}
        </h1>
        <p className={styles.message} data-kind="error" role="alert">
          {WOLF_PREVIEW_WORDS.unavailable}
        </p>
      </section>
    </main>
  )
}
