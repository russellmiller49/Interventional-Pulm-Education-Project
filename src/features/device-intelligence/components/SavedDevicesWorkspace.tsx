'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { comparisonHref, MAX_COMPARISON_DEVICES } from '../domain/saved-devices'
import type { SavedDeviceCard } from '../server/reference-workspace.server'
import { ProductStatusBadges, type ProductStatusLabels } from './ProductStatus'
import { useSavedDevices, type SaveDeviceLabels } from './SavedDevicesProvider'

export function SavedDevicesWorkspace({
  locale,
  labels,
  statusLabels,
  saveLabels,
  typeLabels,
}: {
  locale: string
  labels: Record<
    | 'loading'
    | 'empty'
    | 'find'
    | 'failed'
    | 'retry'
    | 'remove'
    | 'select'
    | 'compare'
    | 'selectionNote'
    | 'unavailable'
    | 'removeUnavailable'
    | 'safety'
    | 'snapshot',
    string
  >
  statusLabels: ProductStatusLabels
  saveLabels: SaveDeviceLabels
  typeLabels: Record<string, string>
}) {
  const saved = useSavedDevices()
  const [result, setResult] = useState<{
    key: string
    devices: SavedDeviceCard[]
    unavailableCount: number
  } | null>(null)
  const [failureKey, setFailureKey] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const idsKey = saved?.ids.join(',') ?? ''
  const ready = saved?.ready ?? false
  useEffect(() => {
    if (!ready || !idsKey) return
    const controller = new AbortController()
    let active = true
    fetch(`/api/device-intelligence/saved?ids=${encodeURIComponent(idsKey)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Lookup failed')
        const data = (await response.json()) as {
          devices: SavedDeviceCard[]
          unavailableCount: number
        }
        if (active) {
          setResult({ key: idsKey, ...data })
          setFailureKey(null)
        }
      })
      .catch(() => {
        if (active) setFailureKey(idsKey)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [idsKey, ready, retry])

  if (!ready) return <p role="status">{labels.loading}</p>
  const devices = result?.key === idsKey ? result.devices : []
  const chosen = selected.filter((id) => devices.some((device) => device.productId === id))
  const unavailable = result?.key === idsKey ? result.unavailableCount : 0
  return (
    <section className="space-y-4">
      {saved?.issue ? (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {saveLabels[saved.issue]}
        </p>
      ) : null}
      {!idsKey ? (
        <p>
          {labels.empty}{' '}
          <Link href={`/${locale}/devices` as Route} className="underline">
            {labels.find}
          </Link>
        </p>
      ) : failureKey === idsKey ? (
        <div role="alert">
          <p>{labels.failed}</p>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-lg border px-4"
            onClick={() => {
              setFailureKey(null)
              setRetry((value) => value + 1)
            }}
          >
            {labels.retry}
          </button>
        </div>
      ) : result?.key !== idsKey ? (
        <p role="status">{labels.loading}</p>
      ) : (
        <>
          <div className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 shadow-sm">
            <p role="status" className="text-sm">
              {labels.selectionNote} ({chosen.length}/{MAX_COMPARISON_DEVICES})
            </p>
            {chosen.length >= 2 ? (
              <Link
                className="min-h-11 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                href={comparisonHref(locale, chosen) as Route}
              >
                {labels.compare}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground"
              >
                {labels.compare}
              </span>
            )}
          </div>
          {unavailable > 0 ? (
            <div className="rounded-xl border p-3 text-sm">
              <p>
                {labels.unavailable} ({unavailable})
              </p>
              <button
                type="button"
                className="min-h-11 underline"
                onClick={() =>
                  saved?.remove(
                    saved.ids.filter((id) => !devices.some((device) => device.productId === id)),
                  )
                }
              >
                {labels.removeUnavailable}
              </button>
            </div>
          ) : null}
          <ul className="grid gap-4 md:grid-cols-2">
            {devices.map((device) => (
              <li
                key={device.productId}
                className="min-w-0 space-y-3 rounded-2xl border border-border p-4 [overflow-wrap:anywhere]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      className="font-semibold underline-offset-2 hover:underline"
                      href={`/${locale}/devices/${device.productId}` as Route}
                    >
                      {device.productName}
                    </Link>
                    <p className="text-sm text-muted-foreground">{device.manufacturer}</p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 rounded-lg border px-3 text-xs"
                    aria-label={`${labels.remove}: ${device.productName} (${device.catalogNumber ?? device.productId})`}
                    onClick={() => saved?.remove([device.productId])}
                  >
                    {labels.remove}
                  </button>
                </div>
                <p className="text-sm">
                  <span className="font-mono">{device.catalogNumber ?? '—'}</span>
                  {device.size ? ` · ${device.size}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeLabels[device.taxonomy.deviceSubtypeCode]}
                </p>
                <ProductStatusBadges status={device.status} labels={statusLabels} />
                <p className="text-xs text-muted-foreground">
                  {statusLabels.evidence.freshness[device.freshness]}
                  {device.status.researchSnapshotDate
                    ? ` · ${labels.snapshot} ${device.status.researchSnapshotDate}`
                    : ''}
                </p>
                <Link
                  href={`/${locale}/devices/${device.productId}#device-safety` as Route}
                  className="inline-block text-xs underline"
                >
                  {labels.safety}
                </Link>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t pt-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={chosen.includes(device.productId)}
                    disabled={
                      chosen.length >= MAX_COMPARISON_DEVICES && !chosen.includes(device.productId)
                    }
                    aria-label={`${labels.select}: ${device.productName} (${device.catalogNumber ?? device.productId})`}
                    onChange={() =>
                      setSelected(
                        chosen.includes(device.productId)
                          ? chosen.filter((id) => id !== device.productId)
                          : [...chosen, device.productId],
                      )
                    }
                  />
                  {labels.select}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
