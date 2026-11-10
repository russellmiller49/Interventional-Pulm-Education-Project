'use client'

import { useState } from 'react'
import { readPrefs, writePrefs } from '../engine/prefs-storage'
import { useHydrated } from './useHydrated'
import styles from './branch-tracing.module.css'

/**
 * The one choice about how a drive runs: fly through the central airways (the default), or stop
 * and choose at every fork from the trachea. Kept on this device; read when a drive is built, so
 * it takes effect on the next lesson or lesion opened.
 */
export function CruiseChoice() {
  // Storage is read only once the page is in the browser; a choice made here then holds.
  const ready = useHydrated()
  const [chosen, setChosen] = useState<boolean | null>(null)
  const everyFork = chosen ?? (ready ? readPrefs().everyFork : false)
  return (
    <label className={styles.cruiseChoice} data-cruise-choice>
      <input
        type="checkbox"
        checked={everyFork}
        disabled={!ready}
        onChange={(event) => {
          setChosen(event.target.checked)
          writePrefs({ everyFork: event.target.checked })
        }}
      />
      <span>
        <strong>Choose at every fork from the trachea.</strong> Left off, the scope flies through
        the central airways and stops at the fork where the segment’s bronchus leaves.
      </span>
    </label>
  )
}
