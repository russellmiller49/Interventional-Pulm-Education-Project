import { WOLF_PREVIEW_DEMO_WORDS, type WolfPreviewDemo } from './demos'
import { WolfPreviewEndForm, WolfPreviewHubLink } from './WolfPreviewChrome'
import { WOLF_PREVIEW_WORDS, wolfPreviewFileUrl } from './paths'
import styles from './wolf-preview-hub.module.css'

/**
 * One presentation demonstration: its own statement first, then the interactive viewer (which
 * opens full-window, as it was built), the video, the stills and what is CT-derived, authored or
 * not claimed. Every file comes from the preview's own authorised file endpoint.
 */
export function WolfPreviewDemoPage({ locale, demo }: { locale: string; demo: WolfPreviewDemo }) {
  const words = WOLF_PREVIEW_DEMO_WORDS
  const file = (path: string) => wolfPreviewFileUrl(demo.id, path)
  return (
    <main className={styles.page} aria-labelledby="wolf-demo-title">
      <nav className={styles.bar} aria-label="Preview">
        <WolfPreviewHubLink locale={locale} />
        <WolfPreviewEndForm locale={locale} />
      </nav>

      <header className={styles.demoHeader}>
        <p className={styles.eyebrow}>
          {WOLF_PREVIEW_WORDS.course} · {WOLF_PREVIEW_WORDS.signedIn}
        </p>
        <h1 id="wolf-demo-title" className={styles.title}>
          {demo.title}
        </h1>
        <p className={styles.kind}>{demo.kind}</p>
        <p className={styles.lead}>{demo.summary}</p>
      </header>

      {demo.statement && (
        <section className={styles.statement} aria-label="Status of this concept">
          <p className={styles.statementLead}>{demo.statement.lead}</p>
          <p>{demo.statement.detail}</p>
        </section>
      )}

      <section className={styles.section} aria-labelledby="wolf-demo-viewer">
        <h2 id="wolf-demo-viewer" className={styles.sectionTitle}>
          {words.viewerHeading}
        </h2>
        <p className={styles.prose}>{demo.viewer.how}</p>
        <p>
          <a className={styles.primary} href={file(demo.viewer.file)}>
            {words.openViewer}
          </a>
        </p>
        <p className={styles.note}>{words.viewerNote}</p>
      </section>

      <section className={styles.section} aria-labelledby="wolf-demo-video">
        <h2 id="wolf-demo-video" className={styles.sectionTitle}>
          {words.videoHeading}
        </h2>
        <video
          className={styles.video}
          controls
          playsInline
          preload="metadata"
          poster={file(demo.video.poster)}
          aria-describedby="wolf-demo-video-caption"
        >
          <source src={file(demo.video.file)} type="video/mp4" />
        </video>
        <p id="wolf-demo-video-caption" className={styles.note}>
          {demo.video.caption}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="wolf-demo-stills">
        <h2 id="wolf-demo-stills" className={styles.sectionTitle}>
          {words.stillsHeading}
        </h2>
        <p className={styles.note}>{words.stillsNote}</p>
        <ul className={styles.stills}>
          {demo.stills.map((still, index) => (
            <li key={still.file}>
              <figure className={styles.still}>
                <a
                  href={file(still.file)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Still ${index + 1} at full resolution (opens in a new tab)`}
                >
                  {/* The bytes are session-gated, so they cannot go through the image optimiser. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file(still.preview)}
                    alt=""
                    width={1600}
                    height={900}
                    loading="lazy"
                    decoding="async"
                  />
                </a>
                <figcaption>{still.caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="wolf-demo-about">
        <h2 id="wolf-demo-about" className={styles.sectionTitle}>
          {words.aboutHeading}
        </h2>
        <div className={styles.about}>
          {demo.sections.map((section) => (
            <div key={section.heading} className={styles.aboutGroup}>
              <h3 className={styles.aboutTitle}>{section.heading}</h3>
              <ul className={styles.aboutList}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        {demo.footer.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </footer>
    </main>
  )
}
