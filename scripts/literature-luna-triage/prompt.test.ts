/** @jest-environment node */
import { STAGE_A_REASON_CODES } from '../../src/features/literature/classifier/stage-a-contract'
import { extractPromptText, loadStageAPrompt } from './prompt'

describe('the committed Stage-A prompt', () => {
  it('extracts exactly the text between the markers', () => {
    const text = extractPromptText('intro\n<!-- PROMPT BEGIN -->\nBODY\n<!-- PROMPT END -->\n')
    expect(text).toBe('BODY')
    expect(() => extractPromptText('no markers here')).toThrow(/markers/u)
  })

  it('loads deterministically with a stable hash', () => {
    const first = loadStageAPrompt()
    const second = loadStageAPrompt()
    expect(first.sha256).toBe(second.sha256)
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('names every reason code in the closed vocabulary exactly', () => {
    const { text } = loadStageAPrompt()
    for (const code of STAGE_A_REASON_CODES) {
      expect(text).toContain(code)
    }
  })

  it('encodes the protective hard rules', () => {
    const { text } = loadStageAPrompt()
    expect(text).toContain('must not be\n   obvious_irrelevant')
    expect(text).toMatch(/escalate, never to exclude/u)
    expect(text).toMatch(/copy it back exactly/iu)
    expect(text).toMatch(/metadata_without_abstract/u)
  })

  it('carries no identities, credentials, or coordinator structure', () => {
    const { text } = loadStageAPrompt()
    for (const forbidden of [
      'pmid',
      'PMID',
      'doi',
      'physician',
      'gold',
      'held-out',
      'heldout',
      'supabase',
      'sk-',
      'OPENAI_API_KEY',
      'dataset',
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})
