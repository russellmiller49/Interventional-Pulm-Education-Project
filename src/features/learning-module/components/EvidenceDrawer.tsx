'use client'

import type { ReactElement } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import styles from './learning-module-v2.module.css'

export interface EvidenceDrawerEntry {
  readonly id: string
  readonly title: string
  readonly sourceLabel: string
  readonly limitation: string
}

export function EvidenceDrawer({
  entries,
  trigger,
}: {
  readonly entries: readonly EvidenceDrawerEntry[]
  readonly trigger: ReactElement
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-[min(92vw,30rem)]">
        <SheetHeader>
          <SheetTitle>Evidence and model limits</SheetTitle>
          <SheetDescription>
            Versioned sources and boundaries for this educational activity.
          </SheetDescription>
        </SheetHeader>
        <div className={styles.drawerBody}>
          {entries.map((entry) => (
            <article key={entry.id} className={styles.drawerEntry}>
              <h3>{entry.title}</h3>
              <p>{entry.sourceLabel}</p>
              <p>
                <strong>Limit:</strong> {entry.limitation}
              </p>
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
