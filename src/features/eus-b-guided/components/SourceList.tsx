import { SOURCES } from '../content/sources'
import styles from './eus-b-guided.module.css'

export function SourceList({ ids }: { ids: readonly string[] }) {
  return (
    <details className={styles.sources}>
      <summary>Sources</summary>
      <ul>
        {SOURCES.filter((source) => ids.includes(source.id)).map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>{' '}
            <small>· {source.type}</small>
          </li>
        ))}
      </ul>
    </details>
  )
}
