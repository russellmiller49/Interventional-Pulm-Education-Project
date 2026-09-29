'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo } from 'react'

import { DeviceExplorer } from '../components/device-explorer/DeviceExplorer'
import { preloadExplorerModel } from '../components/device-explorer/explorerModels'
import type { ExplorerAssetSource } from '../components/device-explorer/sceneLink'
import { catalogue, EXPLORER_DEVICES } from '../content/deviceExplorerCatalogue'
import { WOLF_PREVIEW_END_ENDPOINT, WOLF_PREVIEW_WORDS, wolfPreviewModelUrl } from './paths'
import styles from './wolf-preview.module.css'

const ExplorerViewport = dynamic(() => import('../components/device-explorer/ExplorerViewport'), {
  ssr: false,
  loading: () => <div className="sr-only">Loading the viewer…</div>,
})

const FOOTER = [
  catalogue.label,
  'Development preview for manufacturer review',
  'Device details remain subject to manufacturer fact-check',
  'A dimensional fit is not a statement of compatibility',
]

/**
 * The device explorer for a signed-in reviewer. Models come only from the preview's own
 * authorised endpoint; if one cannot be had, that model says so and the rest keeps working.
 */
export function WolfPreviewExplorer({ locale }: { locale: string }) {
  const source = useMemo<ExplorerAssetSource>(
    () => ({
      name: WOLF_PREVIEW_WORDS.signedIn,
      urlOf: wolfPreviewModelUrl,
      sleeveSeatMm: catalogue.values.sleeveSeatMm.value,
      sizes: new Map(),
    }),
    [],
  )

  // Once the first view is up, fetch the other models while the browser is idle.
  useEffect(() => {
    const preload = () => {
      for (const device of EXPLORER_DEVICES) preloadExplorerModel(source.urlOf(device.id))
    }
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(preload, { timeout: 4000 })
      : window.setTimeout(preload, 1500)
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [source])

  return (
    <DeviceExplorer
      source={source}
      Viewport={ExplorerViewport}
      eyebrow={`${WOLF_PREVIEW_WORDS.course} · ${WOLF_PREVIEW_WORDS.signedIn}`}
      notice={WOLF_PREVIEW_WORDS.disclosure}
      footer={FOOTER}
      headerActions={
        <form method="post" action={WOLF_PREVIEW_END_ENDPOINT}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={styles.endButton}>
            {WOLF_PREVIEW_WORDS.end}
          </button>
        </form>
      }
    />
  )
}
