import type { ReactNode } from 'react'

import styles from './medical-thoracoscopy-module.module.css'

/**
 * What a page shows while its part of the course is being built: what will be here, and that it
 * is not here yet. It never offers a control that does nothing, and records nothing.
 */
export function InPreparation({
  heading,
  children,
}: {
  readonly heading: string
  readonly children: ReactNode
}) {
  return (
    <section className={styles.inPreparation} aria-labelledby="in-preparation-heading">
      <h1 id="in-preparation-heading">{heading}</h1>
      {children}
    </section>
  )
}
