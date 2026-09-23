import type { CatalogCase } from '../projections'
import { groupCatalog } from '../projections'
import {
  caseProgressLabel,
  orderedModules,
  orderedModuleCases,
  trainingHref,
  type CurriculumModule,
} from '../curriculum'
import type { TrainingProgress } from '../model'
import styles from './study.module.css'

export function CurriculumDirectory({
  locale,
  modules,
  selected,
  cases,
  progress,
}: {
  locale: string
  modules: CurriculumModule[]
  selected?: string
  cases: CatalogCase[]
  progress: TrainingProgress[] | null
}) {
  const module = modules.find((m) => m.id === selected)
  if (selected && !module)
    return (
      <>
        <h1>Module unavailable</h1>
        <a href={`/${locale}/socrates`}>Back to modules</a>
      </>
    )
  return (
    <>
      <h1>{module?.title ?? 'SOCRATES training modules'}</h1>
      <p>
        {module?.purpose ??
          'Start with the core orientation, then choose optional modules for further review. Inspect each image before revealing its teaching interpretation.'}
      </p>
      {module ? (
        <>
          <a href={`/${locale}/socrates`}>Back to modules</a>
          <p>
            {module.cases.length} available / {module.plannedCount} planned cases
          </p>
          <p>
            Only reviewed, published cases with approved module membership are available. Positions
            follow the source plan, so gaps may remain while cases are reviewed.
          </p>
          {!module.cases.length && <p>No cases are available in this module yet.</p>}
          <ol className={styles.caseList} aria-label="Ordered module cases">
            {orderedModuleCases(module).map((entry) => (
              <li key={entry.id} value={entry.position}>
                <a href={trainingHref(locale, entry.id, module.id)}>{entry.title}</a>
                {progress && <span> · {caseProgressLabel(entry, progress)}</span>}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <div className={styles.cards}>
            {orderedModules(modules).map((m) => (
              <article key={m.id} className={styles.card}>
                <p className={styles.eyebrow}>
                  {m.recommendedStart
                    ? 'Recommended starting point'
                    : m.level === 'Advanced'
                      ? 'Optional advanced review'
                      : 'Optional deep dive'}
                </p>
                <h2>
                  <a href={`/${locale}/socrates?module=${encodeURIComponent(m.id)}`}>{m.title}</a>
                </h2>
                <p>{m.purpose}</p>
                <p>
                  {m.cases.length} available / {m.plannedCount} planned cases
                </p>
              </article>
            ))}
          </div>
          <p>
            Planned counts describe the source curriculum, including cases awaiting review and
            membership decisions. They are not a completion requirement.
          </p>
        </>
      )}
      <details className={styles.panel}>
        <summary>Browse available cases by diagnosis</summary>
        {!cases.length && <p>No reviewed training cases have been published yet.</p>}
        {groupCatalog(module ? module.cases : cases).map(([category, entries]) => (
          <section key={category}>
            <h2>{category}</h2>
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <a href={trainingHref(locale, entry.id, module?.id)}>{entry.title}</a>
                  {progress && <span> · {caseProgressLabel(entry, progress)}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </details>
    </>
  )
}

export function ModuleNavigation({
  locale,
  navigation,
}: {
  locale: string
  navigation: NonNullable<ReturnType<typeof import('../curriculum').moduleNavigation>>
}) {
  const { module, current, previous, next } = navigation
  return (
    <nav className={styles.nav} aria-label="Module case navigation">
      <a href={`/${locale}/socrates?module=${encodeURIComponent(module.id)}`}>
        Back to {module.title}
      </a>
      <span>
        Position {current.position} of {module.plannedCount} planned
      </span>
      {previous && (
        <a href={trainingHref(locale, previous.id, module.id)}>Previous case in module</a>
      )}
      {next && <a href={trainingHref(locale, next.id, module.id)}>Next case in module</a>}
    </nav>
  )
}
