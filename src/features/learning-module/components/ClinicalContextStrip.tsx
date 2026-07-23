import type { ReactNode } from 'react'

import styles from './learning-module-v2.module.css'

export function ClinicalContextStrip({ children }: { readonly children: ReactNode }) {
  return (
    <section className={styles.contextStrip} aria-label="Clinical context">
      {children}
    </section>
  )
}
