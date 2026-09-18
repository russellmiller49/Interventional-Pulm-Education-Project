'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import {
  COMPARE_SELECTION_KEY,
  parseCompareSelection,
  serializeCompareSelection,
  toggleCompareSelection,
} from '../domain/compare-selection'
import { comparisonHref, MAX_COMPARISON_DEVICES } from '../domain/saved-devices'

/**
 * Comparison selection for the Device Atlas: a small client island over an otherwise
 * server-rendered module. It mirrors `SavedDevicesProvider` (identifiers only, validated
 * storage, in-memory fallback, cross-tab sync) but keeps its own key — see
 * `domain/compare-selection.ts` for why saving and comparing stay separate.
 */

type CompareIssue = 'storage' | 'limit' | null
interface CompareSelectionState {
  ids: string[]
  ready: boolean
  issue: CompareIssue
  toggle: (id: string) => void
  remove: (id: string) => void
  clear: () => void
}
const CompareSelectionContext = createContext<CompareSelectionState | null>(null)

export function CompareSelectionProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [issue, setIssue] = useState<CompareIssue>(null)
  const currentIds = useRef<string[]>([])
  const memoryOnly = useRef(false)

  useEffect(() => {
    const read = () => {
      try {
        const loaded = parseCompareSelection(window.localStorage.getItem(COMPARE_SELECTION_KEY))
        currentIds.current = loaded
        memoryOnly.current = false
        setIds(loaded)
        setIssue(null)
      } catch {
        memoryOnly.current = true
        setIssue('storage')
      }
      setReady(true)
    }
    read()
    const onStorage = (event: StorageEvent) => {
      if (event.key === COMPARE_SELECTION_KEY || event.key === null) read()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const commit = useCallback((next: string[]) => {
    currentIds.current = next
    setIds(next)
    try {
      // A malformed stored record is never overwritten; the session stays usable in memory.
      if (memoryOnly.current) throw new Error('Storage unavailable')
      window.localStorage.setItem(COMPARE_SELECTION_KEY, serializeCompareSelection(next))
      setIssue(null)
    } catch {
      memoryOnly.current = true
      setIssue('storage')
    }
  }, [])

  const latest = useCallback(() => {
    if (memoryOnly.current) return currentIds.current
    try {
      return parseCompareSelection(window.localStorage.getItem(COMPARE_SELECTION_KEY))
    } catch {
      memoryOnly.current = true
      return currentIds.current
    }
  }, [])

  const toggle = useCallback(
    (id: string) => {
      if (!ready) return
      const result = toggleCompareSelection(latest(), id)
      if (result.ok) commit(result.ids)
      else if (result.reason === 'limit') setIssue('limit')
    },
    [commit, latest, ready],
  )
  const remove = useCallback(
    (id: string) => {
      if (ready) commit(latest().filter((entry) => entry !== id))
    },
    [commit, latest, ready],
  )
  const clear = useCallback(() => {
    if (ready) commit([])
  }, [commit, ready])

  return (
    <CompareSelectionContext.Provider value={{ ids, ready, issue, toggle, remove, clear }}>
      {children}
    </CompareSelectionContext.Provider>
  )
}

export function useCompareSelection() {
  return useContext(CompareSelectionContext)
}

export interface CompareLabels {
  add: string
  added: string
  limit: string
  storage: string
  trayHeading: string
  trayCompare: string
  trayNeedTwo: string
  trayRemove: string
  trayClear: string
  navCompare: string
}

export function CompareButton({
  productId,
  productName,
  catalogNumber,
  labels,
}: {
  productId: string
  productName: string
  catalogNumber?: string | null
  labels: CompareLabels
}) {
  const selection = useCompareSelection()
  const [acted, setActed] = useState(false)
  const selected = selection?.ids.includes(productId) ?? false
  return (
    <div className="print:hidden">
      <button
        type="button"
        disabled={!selection?.ready}
        aria-pressed={selected}
        aria-label={`${selected ? labels.added : labels.add}: ${productName}${catalogNumber ? ` (${catalogNumber})` : ''}`}
        onClick={() => {
          setActed(true)
          selection?.toggle(productId)
        }}
        className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
          selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted'
        }`}
      >
        {selected ? labels.added : labels.add}
      </button>
      {acted && !selected && selection?.issue ? (
        <p role="status" className="mt-1 max-w-sm text-xs text-muted-foreground">
          {labels[selection.issue]}
        </p>
      ) : null}
    </div>
  )
}

/** Task-navigation entry that appears only while a comparison selection exists. */
export function CompareNavLink({ locale, label }: { locale: string; label: string }) {
  const selection = useCompareSelection()
  const pathname = usePathname()
  if (!selection?.ready || selection.ids.length === 0) return null
  const active = pathname?.endsWith('/devices/compare') ?? false
  return (
    <Link
      href={comparisonHref(locale, selection.ids) as Route}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-primary px-4 py-2 text-primary-foreground'
          : 'rounded-full border border-border px-4 py-2 hover:bg-muted'
      }
    >
      {label} ({selection.ids.length})
    </Link>
  )
}

interface TrayDevice {
  productId: string
  productName: string
  catalogNumber: string | null
}

/**
 * The persistent comparison tray. Stored state is identifiers only, so names are resolved
 * through the same cohort-walled lookup the saved-devices workspace uses; an identifier the
 * reference no longer contains is shown as unavailable rather than guessed at.
 */
export function CompareTray({ locale, labels }: { locale: string; labels: CompareLabels }) {
  const selection = useCompareSelection()
  const pathname = usePathname()
  const [resolved, setResolved] = useState<{ key: string; devices: TrayDevice[] } | null>(null)
  const idsKey = selection?.ids.join(',') ?? ''

  useEffect(() => {
    if (!idsKey) return
    const controller = new AbortController()
    let active = true
    fetch(`/api/device-intelligence/saved?ids=${encodeURIComponent(idsKey)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Lookup failed')
        const data = (await response.json()) as { devices: TrayDevice[] }
        if (active) setResolved({ key: idsKey, devices: data.devices })
      })
      .catch(() => {
        if (active) setResolved({ key: idsKey, devices: [] })
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [idsKey])

  if (!selection?.ready || selection.ids.length === 0) return null
  // The comparison page already IS the comparison; a tray over it would only repeat it.
  if (pathname?.endsWith('/devices/compare')) return null

  const names = new Map(
    (resolved?.key === idsKey ? resolved.devices : []).map((device) => [device.productId, device]),
  )
  const canCompare = selection.ids.length >= 2
  return (
    <>
      {/* Reserve room so the fixed tray never covers the end of the page. */}
      <div aria-hidden="true" className="h-24 print:hidden" />
      <section
        aria-label={labels.trayHeading}
        data-compare-tray
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur print:hidden"
      >
        <div className="container flex flex-wrap items-center gap-x-4 gap-y-2 py-2 sm:py-3">
          <h2 className="text-sm font-bold">
            {labels.trayHeading}{' '}
            <span role="status" className="font-normal text-muted-foreground">
              ({selection.ids.length}/{MAX_COMPARISON_DEVICES})
            </span>
          </h2>
          {/* Phones get the one-line tray (count, Clear, Compare); the named chips need the
              width of a tablet or desktop. Devices stay removable everywhere through their
              own Compare toggles. */}
          <ul className="hidden min-w-0 flex-1 flex-wrap gap-2 sm:flex">
            {selection.ids.map((id) => {
              const device = names.get(id)
              const name = device?.productName ?? id
              return (
                <li
                  key={id}
                  className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-3 pr-1 text-xs"
                >
                  <span className="truncate">
                    {name}
                    {device?.catalogNumber ? (
                      <span className="ml-1 font-mono text-muted-foreground">
                        {device.catalogNumber}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => selection.remove(id)}
                    aria-label={`${labels.trayRemove}: ${name}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base leading-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={selection.clear}
              className="min-h-11 rounded px-1 text-xs font-medium text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels.trayClear}
            </button>
            {canCompare ? (
              <Link
                href={comparisonHref(locale, selection.ids) as Route}
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {labels.trayCompare} ({selection.ids.length})
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">{labels.trayNeedTwo}</span>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

/**
 * "Remove" on the comparison page. The page itself is URL-driven, so this is an ordinary link
 * to the same comparison without one device; it additionally drops the device from the stored
 * selection so the tray agrees with what the reader just did.
 */
export function CompareRemoveLink({
  href,
  productId,
  label,
  accessibleLabel,
}: {
  href: string
  productId: string
  label: string
  accessibleLabel: string
}) {
  const selection = useCompareSelection()
  return (
    <Link
      href={href as Route}
      aria-label={accessibleLabel}
      onClick={() => selection?.remove(productId)}
      className="mt-2 inline-flex min-h-9 items-center rounded text-xs font-medium text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden"
    >
      {label}
    </Link>
  )
}
