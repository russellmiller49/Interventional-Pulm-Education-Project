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
import {
  MAX_SAVED_DEVICES,
  parseSavedDevices,
  SAVED_DEVICES_KEY,
  serializeSavedDevices,
} from '../domain/saved-devices'
import { isWellFormedProductId } from '../domain/product-id'

type SaveIssue = 'storage' | 'limit' | null
interface SavedDevicesState {
  ids: string[]
  ready: boolean
  issue: SaveIssue
  toggle: (id: string) => void
  remove: (ids: string[]) => void
}
const SavedDevicesContext = createContext<SavedDevicesState | null>(null)

export function SavedDevicesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [issue, setIssue] = useState<SaveIssue>(null)
  const currentIds = useRef<string[]>([])
  const memoryOnly = useRef(false)
  useEffect(() => {
    const read = () => {
      try {
        const loaded = parseSavedDevices(window.localStorage.getItem(SAVED_DEVICES_KEY))
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
      if (event.key === SAVED_DEVICES_KEY || event.key === null) read()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const change = useCallback(
    (update: (previous: string[]) => string[]) => {
      if (!ready) return
      let previous = currentIds.current
      if (!memoryOnly.current) {
        try {
          previous = parseSavedDevices(window.localStorage.getItem(SAVED_DEVICES_KEY))
        } catch {
          memoryOnly.current = true
        }
      }
      const next = update(previous)
      if (next.length > MAX_SAVED_DEVICES) {
        setIssue('limit')
        return
      }
      currentIds.current = next
      setIds(next)
      try {
        // A malformed/unsupported record is not overwritten; this session remains usable.
        if (memoryOnly.current) throw new Error('Storage unavailable')
        window.localStorage.setItem(SAVED_DEVICES_KEY, serializeSavedDevices(next))
        setIssue(null)
      } catch {
        memoryOnly.current = true
        setIssue('storage')
      }
    },
    [ready],
  )

  const toggle = useCallback(
    (id: string) => {
      if (!isWellFormedProductId(id)) return
      change((previous) =>
        previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
      )
    },
    [change],
  )
  const remove = useCallback(
    (removed: string[]) => {
      change((previous) => previous.filter((id) => !removed.includes(id)))
    },
    [change],
  )

  return (
    <SavedDevicesContext.Provider value={{ ids, ready, issue, toggle, remove }}>
      {children}
    </SavedDevicesContext.Provider>
  )
}

export function useSavedDevices() {
  return useContext(SavedDevicesContext)
}

export interface SaveDeviceLabels {
  save: string
  saved: string
  storage: string
  limit: string
}

export function SaveDeviceButton({
  productId,
  productName,
  catalogNumber,
  labels,
}: {
  productId: string
  productName: string
  catalogNumber?: string | null
  labels: SaveDeviceLabels
}) {
  const saved = useSavedDevices()
  const [acted, setActed] = useState(false)
  const selected = saved?.ids.includes(productId) ?? false
  return (
    <div className="print:hidden">
      <button
        type="button"
        disabled={!saved?.ready}
        aria-pressed={selected}
        aria-label={`${selected ? labels.saved : labels.save}: ${productName}${catalogNumber ? ` (${catalogNumber})` : ''}`}
        onClick={() => {
          setActed(true)
          saved?.toggle(productId)
        }}
        className="min-h-11 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {selected ? labels.saved : labels.save}
      </button>
      {acted && saved?.issue ? (
        <p role="status" className="mt-1 max-w-sm text-xs text-muted-foreground">
          {labels[saved.issue]}
        </p>
      ) : null}
    </div>
  )
}
