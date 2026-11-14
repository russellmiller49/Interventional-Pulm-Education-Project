import { INVENIO_DEMO_ORIGIN } from '../invenio-source'

/** Provider's shared UCSD viewer key, checked against its SVG on 2026-10-12.
 * These describe provider image colors, independently of authored teaching boxes.
 */
export const invenioAnnotationKeySource = `${INVENIO_DEMO_ORIGIN}/assets/annotation-key-DI2mkxIw.svg`

export const invenioAnnotationKey = [
  { color: '#FF0000', label: 'Tumor / malignant' },
  { color: '#00FF00', label: 'Non-tumor / normal lung tissue' },
  { color: '#0000FF', label: 'Non-diagnostic / low quality' },
  { color: '#191919', label: 'Non-diagnostic necrosis (no tumor present)' },
  { color: '#FFFF00', label: 'Diagnostic necrosis (tumor present)' },
  { color: '#00FFFF', label: 'Atypical / cannot exclude tumor' },
  { color: '#000066', label: 'Unsure' },
  { color: '#FF00FF', label: 'Granuloma' },
  { color: '#660066', label: 'Granulomatous inflammation' },
  { color: '#00FFCC', label: 'Infection / abscess' },
  { color: '#999966', label: 'Hamartoma' },
  { color: '#CC9900', label: 'Nonspecific benign process' },
  { color: '#663300', label: 'Necrotizing granulomatous inflammation' },
  { color: '#CCFF33', label: 'Other specific benign process' },
] as const
