import { SOURCES } from '../content/sources'
import styles from './course.module.css'
export function SourceList({ ids }: { ids: readonly string[] }) {
  return (
    <details className={styles.sources}>
      <summary>Sources</summary>
      <ul>
        {SOURCES.filter((s) => ids.includes(s.id)).map((s) => (
          <li key={s.id}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}{' '}
            <small>· {s.type}</small>
          </li>
        ))}
      </ul>
    </details>
  )
}
