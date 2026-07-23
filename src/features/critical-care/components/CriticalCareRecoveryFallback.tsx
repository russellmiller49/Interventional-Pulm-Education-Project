import { Link } from '@/i18n/navigation'

import type { CriticalCarePublicClientCatalog } from '../content/publicCatalogTypes'

interface CriticalCareRecoveryFallbackProps {
  readonly catalog: CriticalCarePublicClientCatalog
}

export function CriticalCareRecoveryFallback({ catalog }: CriticalCareRecoveryFallbackProps) {
  return (
    <main className="mx-auto grid w-[min(72rem,calc(100%-2rem))] gap-6 py-10">
      <header className="grid gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
          Critical care recovery
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Open a native module workspace</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          The unified dashboard is disabled by configuration. Existing module routes and local
          progress remain available and unchanged.
        </p>
      </header>
      <ul className="grid gap-3 p-0 sm:grid-cols-2">
        {catalog.modules.map((module) => (
          <li key={module.id} className="list-none rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">{module.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {module.subtitle ?? 'Open the preserved module workspace.'}
            </p>
            <Link
              href={module.href}
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold"
            >
              Open full lab
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
