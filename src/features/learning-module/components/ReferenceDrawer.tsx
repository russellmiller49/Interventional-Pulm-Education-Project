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

export interface ReferenceDrawerEntry {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly meta?: string
}

export function ReferenceDrawer({
  entries,
  trigger,
  title = 'Reference',
}: {
  readonly entries: readonly ReferenceDrawerEntry[]
  readonly trigger: ReactElement
  readonly title?: string
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-[min(92vw,30rem)]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Point-of-use learning records. Return to the activity when ready.
          </SheetDescription>
        </SheetHeader>
        <div className={styles.drawerBody}>
          {entries.map((entry) => (
            <article key={entry.id} className={styles.drawerEntry}>
              <h3>{entry.title}</h3>
              <p>{entry.summary}</p>
              {entry.meta ? <p>{entry.meta}</p> : null}
            </article>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
