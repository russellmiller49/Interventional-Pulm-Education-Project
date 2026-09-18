import type { Route } from 'next'
import Link from 'next/link'

import { CompareNavLink } from './CompareSelection'

export type DeviceTask = 'find' | 'procedures' | 'saved' | 'compare'

/**
 * The module's task navigation: find a device, prepare a procedure, saved devices — plus a
 * Compare entry that appears only while a comparison selection exists. Plain links; the
 * current task is announced with `aria-current`.
 */
export function DeviceTaskNav({
  locale,
  active,
  labels,
}: {
  locale: string
  active: DeviceTask
  labels: { navigation: string; find: string; procedures: string; saved: string; compare: string }
}) {
  const tasks: { key: DeviceTask; href: string; label: string }[] = [
    { key: 'find', href: `/${locale}/devices`, label: labels.find },
    { key: 'procedures', href: `/${locale}/procedures`, label: labels.procedures },
    { key: 'saved', href: `/${locale}/devices/saved`, label: labels.saved },
  ]
  return (
    <nav
      aria-label={labels.navigation}
      className="flex flex-wrap gap-2 text-sm font-semibold print:hidden"
    >
      {tasks.map((task) => (
        <Link
          key={task.key}
          href={task.href as Route}
          aria-current={task.key === active ? 'page' : undefined}
          className={
            task.key === active
              ? 'rounded-full bg-primary px-4 py-2 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              : 'rounded-full border border-border px-4 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          }
        >
          {task.label}
        </Link>
      ))}
      <CompareNavLink locale={locale} label={labels.compare} />
    </nav>
  )
}
