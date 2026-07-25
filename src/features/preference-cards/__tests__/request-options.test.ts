import { parsePreferenceCardSearch } from '../data/request-options'

describe('preference-card route request parsing', () => {
  it('accepts bounded modifiers and tri-state conditional decisions', () => {
    const parsed = parsePreferenceCardSearch({
      modifiers: 'ROSE,SPEC_MOLECULAR,not allowed',
      generatedAt: '2026-07-25T12:00:00.000Z',
      conditions: JSON.stringify({
        'slot-1': 'include',
        'slot-2': 'undecided',
      }),
      items: JSON.stringify({
        'slot-1': 'hospital-item-1',
        'slot-2': null,
      }),
      waivers: JSON.stringify({
        'message-1': 'Reviewed by the prototype administrator.',
      }),
      mode: 'chronological',
    })

    expect(parsed.modifierCodes).toEqual(['ROSE', 'SPEC_MOLECULAR'])
    expect(parsed.conditionalStates).toEqual({
      'slot-1': 'include',
      'slot-2': 'undecided',
    })
    expect(parsed.selectedHospitalItemIds).toEqual({
      'slot-1': 'hospital-item-1',
      'slot-2': null,
    })
    expect(parsed.waivers).toEqual({
      'message-1': 'Reviewed by the prototype administrator.',
    })
    expect(parsed.mode).toBe('chronological')
  })

  it('fails safely for malformed conditional JSON and print modes', () => {
    const parsed = parsePreferenceCardSearch({
      conditions: '{bad',
      items: '{bad',
      waivers: JSON.stringify({ 'message-1': 'short' }),
      mode: 'unexpected',
    })
    expect(parsed.conditionalStates).toBeUndefined()
    expect(parsed.selectedHospitalItemIds).toBeUndefined()
    expect(parsed.waivers).toBeUndefined()
    expect(parsed.mode).toBe('spatial')
  })

  it('preserves an explicit empty modifier selection', () => {
    const parsed = parsePreferenceCardSearch({ modifiers: '' })
    expect(parsed.modifierCodes).toEqual([])
    expect(parsed.serialized).toContain('modifiers=')
  })
})
