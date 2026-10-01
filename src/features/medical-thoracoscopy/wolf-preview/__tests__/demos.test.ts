/** @jest-environment node */
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import { WOLF_PREVIEW_CARDS, WOLF_PREVIEW_DEMO_WORDS, WOLF_PREVIEW_DEMOS } from '../demos'

/**
 * The hub and demonstration pages keep the demonstrations' own statements of what they are not,
 * and claim nothing positive: wherever approval, validation or finality is mentioned, it is
 * denied in the same sentence.
 */
const PROMOTIONAL_WORDING =
  /\b(best|leading|superior|unrivalled|unrivaled|unique|unmatched|world-class|state-of-the-art|cutting-edge|revolutionary|innovative|optimal|optimum|maximum versatility|seamless|effortless|premium|trusted|preferred)\b/i
const CLAIM = /approv|validat|\bfinal\b|production ready|manufacturer accurate|clinically proven/i
const DENIAL =
  /\b(not|no|nor|never|nothing|without)\b|n[’']t|would need|needs engineering validation|validation required|development and validation/i

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

const COPY = strings([WOLF_PREVIEW_CARDS, WOLF_PREVIEW_DEMOS, WOLF_PREVIEW_DEMO_WORDS]).filter(
  (text) => !/^[a-z0-9/.-]+\.(html|mp4|jpg|png)$/.test(text) && !/^[a-z-]+$/.test(text),
)

describe('preview hub and demonstration copy', () => {
  it('claims no approval, validation or finality anywhere', () => {
    const sentences = COPY.flatMap((text) => text.split(/(?<=[.;:!?])\s+|\s+·\s+|\s+—\s+/))
    const claims = sentences.filter((sentence) => CLAIM.test(sentence) && !DENIAL.test(sentence))
    expect(claims).toEqual([])
  })

  it('keeps the demonstrations’ own statements of what they are not', () => {
    const trainer = WOLF_PREVIEW_DEMOS['portable-trainer-concept']
    expect(trainer.statement?.lead).toBe(
      'No physical thoracoscopy trainer has been built, measured or validated.',
    )
    expect(trainer.footer).toContain(
      'Early engineering concept — development and validation required',
    )
    expect(strings(trainer.sections).join(' ')).toContain('Inputs, not the tip.')
    const pleural = strings(WOLF_PREVIEW_DEMOS['pleural-model-progress']).join(' ')
    expect(pleural).toContain('not clinically validated')
    expect(pleural).toContain('not reviewed by the manufacturer')
    expect(pleural).toContain('CC BY 4.0')
  })

  it('uses no promotional wording, mark, product number or internal vocabulary', () => {
    for (const text of COPY) {
      // "superior–inferior" is an anatomical direction, not a claim.
      const prose = text.replace(/superior[–-]inferior/g, '')
      expect({ text, promotional: PROMOTIONAL_WORDING.test(prose) }).toEqual({
        text,
        promotional: false,
      })
      expect(text).not.toMatch(
        /wolf|eragon|endocam|richard|R-DEVICE|packet|register|Local-Data|internal/i,
      )
      // The register's status word; "not reviewed by the manufacturer" is a disclosure.
      expect(text).not.toMatch(/NOT REVIEWED/)
      expect(text).not.toMatch(/\b89\d{2}\.\d{3}\b|\b83\d{5,6}\b/)
    }
  })

  it('passes the course’s learner-copy gate', () => {
    for (const text of COPY) {
      expect({ text, flagged: flaggedLearnerCopyTerms(text) }).toEqual({ text, flagged: [] })
    }
  })
})
