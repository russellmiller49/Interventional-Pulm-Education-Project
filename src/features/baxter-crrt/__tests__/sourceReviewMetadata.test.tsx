import { render, within } from '@testing-library/react'

import { CrrtSourceDating } from '../components/CrrtSourceDating'
import { SourcesPanel } from '../components/SourcesPanel'
import { crrtCitrateSourceReferences } from '../content/citrateSources'
import { isResolvableCrrtSourceId } from '../content/learnerSourceMap'
import { CRRT_AUTHORING_ASSISTANT, CRRT_SOURCE_DATING } from '../content/sourceReviewMetadata'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

describe('G01 CRRT source type, dates and document checks', () => {
  it('dates only sources that a learner citation resolves to', () => {
    expect(CRRT_SOURCE_DATING.size).toBeGreaterThan(0)
    for (const id of CRRT_SOURCE_DATING.keys()) expect(isResolvableCrrtSourceId(id)).toBe(true)
  })

  it('keeps publication, revision and document checks apart, and never calls a check a review', () => {
    for (const dating of CRRT_SOURCE_DATING.values()) {
      expect(dating.publishedBasis.length).toBeGreaterThan(0)
      expect(dating.checks.length).toBeGreaterThan(0)
      for (const check of dating.checks) {
        expect(check.on).toMatch(ISO_DATE)
        // A checker is either the recorded assistant or explicitly unknown — never an inferred name.
        expect([null, CRRT_AUTHORING_ASSISTANT]).toContain(check.by)
        expect(check.recordedIn.length).toBeGreaterThan(0)
        expect(`${check.scope} ${dating.limitation}`).not.toMatch(
          /approv|clinically reviewed|review(?:ed)? (?:is )?complete|validated/i,
        )
        // A check date is its own field, never the publication date copied across.
        expect(check.on).not.toBe(dating.published)
      }
    }
  })

  it('moves the citrate reading date out of the citation text and into a dated check', () => {
    for (const source of crrtCitrateSourceReferences) {
      expect(source.documentVersion).not.toMatch(/read \d{4}-\d{2}-\d{2}/)
      expect(CRRT_SOURCE_DATING.get(source.id)?.checks.map((check) => check.on)).toContain(
        '2026-09-13',
      )
    }
  })

  it('records the filter-drop correction as a held reading, and TMP as found on its page', () => {
    const dropCheck = CRRT_SOURCE_DATING.get('DEV-PM-010')?.checks.find(
      (check) => check.by === CRRT_AUTHORING_ASSISTANT,
    )
    expect(dropCheck?.scope).toMatch(/PDF page 203/)
    expect(dropCheck?.scope).toMatch(/prints no −25 mmHg term in the drop itself/)
    expect(dropCheck?.scope).toMatch(/awaits device review/)
    const tmpCheck = CRRT_SOURCE_DATING.get('MATH-PM-002')?.checks.find(
      (check) => check.by === CRRT_AUTHORING_ASSISTANT,
    )
    expect(tmpCheck?.scope).toMatch(/PDF page 218/)
  })

  it('shows every dated source in the hub panel with no lesson, answer or case state', () => {
    const { container } = render(<SourcesPanel />)
    const batch = container.querySelector<HTMLElement>('[data-source-batch="g01-crrt"]')
    expect(batch).not.toBeNull()
    for (const id of CRRT_SOURCE_DATING.keys()) {
      const dating = batch!.querySelector<HTMLElement>(`[data-source-dating="${id}"]`)
      expect(dating).not.toBeNull()
      expect(dating).toHaveTextContent('Clinical and device review: none recorded yet.')
    }
    const drop = within(batch!.querySelector<HTMLElement>('[data-source-dating="DEV-PM-010"]')!)
    expect(drop.getByText('Published: June 2019')).toBeInTheDocument()
    expect(drop.getByText('Revision: AW8035 Rev B · program version 2.XX')).toBeInTheDocument()
    expect(drop.getAllByText(/^Checked against the document on/)).toHaveLength(2)
    // F-19: a missing checker is said in plain words; the missing name is still disclosed.
    expect(drop.getByText(/\(the record does not name who checked\)/)).toBeInTheDocument()
  })

  it('renders nothing for a source outside the dated batch', () => {
    const { container } = render(<CrrtSourceDating sourceId="DOSE-PM-001" />)
    expect(container).toBeEmptyDOMElement()
  })
})
