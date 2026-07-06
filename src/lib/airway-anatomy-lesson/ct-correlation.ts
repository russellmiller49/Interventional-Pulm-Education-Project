/**
 * Runtime loader for the airway lesson's CT-to-endoscopy correlation slices.
 *
 * The axial/coronal JPGs and this manifest are generated offline by
 * scripts/airway-lesson/render-ct-correlation.py from the case-001 preview CT
 * volume. We pre-render (rather than load the 27 MB int16 volume in the browser
 * like the admin synchronized-bronchoscopy module) because the volume sits
 * behind the site_admin gate on /airway-anatomy/*, while this lesson is only
 * draft-gated — and the guided survey visits a fixed set of stops, so a handful
 * of compact images is far lighter than a client CT engine.
 */

/** Public URL of the CT correlation manifest (served statically, no auth). */
export const CT_CORRELATION_URL = '/airway-lesson/airway-survey-ct.json'

export interface CtCorrelationStructure {
  /** Axial slice image URL, crosshair marking the airway. */
  axial: string
  /** Coronal slice image URL, crosshair marking the airway. */
  coronal: string
  /** Representative airway point in patient LPS millimetres. */
  lps: [number, number, number]
  /** Axial (superior→inferior) slice index in the preview volume. */
  axialSlice: number
  /** Coronal (anterior→posterior) slice index in the preview volume. */
  coronalSlice: number
}

export interface CtCorrelationData {
  meta: {
    source: string
    window: { low: number; high: number; label: string }
    sizeXyz: [number, number, number]
    note: string
  }
  /** Lesson AirwayNode id → its pre-rendered CT slices. */
  structures: Record<string, CtCorrelationStructure | undefined>
}

let cache: Promise<CtCorrelationData> | null = null

/**
 * Load the CT correlation manifest, memoised at module scope. The fetch is not
 * tied to any caller's AbortSignal on purpose: the shared promise outlives a
 * single component mount, so aborting it from one unmount (e.g. React StrictMode
 * double-invoke) must not reject it for everyone. Callers guard their own state
 * updates against unmount instead.
 */
export function loadCtCorrelation(): Promise<CtCorrelationData> {
  if (cache) return cache
  cache = fetch(CT_CORRELATION_URL, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load CT correlation: ${res.status}`)
      return res.json() as Promise<CtCorrelationData>
    })
    .catch((err) => {
      cache = null // allow a retry on next mount
      throw err
    })
  return cache
}
