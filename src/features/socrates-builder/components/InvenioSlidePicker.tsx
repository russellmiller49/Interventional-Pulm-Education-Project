'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { INVENIO_DEMO_ORIGIN, INVENIO_RELAY_PATH, getInvenioPair } from '../invenio-source'
import styles from './socrates-builder.module.css'

const catalogSchema = z.object({
  cases: z.array(
    z.object({
      slides: z.array(
        z.object({
          id: z.string(),
          caseNumber: z.string(),
          series: z.string(),
          barcode: z.string(),
        }),
      ),
    }),
  ),
})

type CatalogSlide = z.infer<typeof catalogSchema>['cases'][number]['slides'][number]

export function InvenioSlidePicker({
  onLoad,
  disabled,
}: {
  onLoad: (url: string) => void
  disabled: boolean
}) {
  const [slides, setSlides] = useState<CatalogSlide[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadCatalog() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${INVENIO_RELAY_PATH}/catalog.json`, { credentials: 'omit' })
      if (!response.ok)
        throw new Error('The Invenio catalog is unavailable. Try again or paste a slide link.')
      const catalog = catalogSchema.parse(await response.json())
      const available = catalog.cases
        .flatMap((item) => item.slides)
        .filter((slide) => getInvenioPair(`${INVENIO_DEMO_ORIGIN}/slides/${slide.id}`))
      if (!available.length) throw new Error('No paired slides are currently available.')
      setSlides(available)
      setSelectedId(available[0].id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the Invenio catalog.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.invenioPicker}>
      <strong>Invenio comparison library</strong>
      <p>Start with the team’s paired tissue and color annotation images.</p>
      {slides.length ? (
        <>
          <label className={styles.field}>
            <span>Invenio demo slide · {slides.length} available</span>
            <select
              aria-label="Invenio demo slide"
              value={selectedId}
              disabled={disabled}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {slides.map((slide) => (
                <option key={slide.id} value={slide.id}>
                  Case {slide.caseNumber} · Series {slide.series} · {slide.barcode}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => onLoad(`${INVENIO_DEMO_ORIGIN}/slides/${selectedId}`)}
          >
            Load paired slide
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || disabled}
          onClick={() => void loadCatalog()}
        >
          {loading ? 'Loading catalog…' : 'Browse Invenio demo slides'}
        </Button>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
