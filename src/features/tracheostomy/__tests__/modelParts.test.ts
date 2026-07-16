import {
  getTracheostomyPart,
  tracheostomyModelParts,
  tracheostomyPartColors,
} from '@/features/tracheostomy/content/modelParts'

describe('tracheostomy segmented 3D model content', () => {
  test('every selectable component has a unique id and color', () => {
    const ids = tracheostomyModelParts.map((part) => part.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(tracheostomyPartColors).sort()).toEqual([...ids].sort())
  })

  test('the removable components encode the critical setup guardrails', () => {
    expect(getTracheostomyPart('obturator').safety).toMatch(/not ventilatable/i)
    expect(getTracheostomyPart('inner-cannula').safety).toMatch(/obstruction/i)
  })

  test('cuff teaching prevents the unsafe speaking-valve state', () => {
    const cuff = getTracheostomyPart('cuff')

    expect(cuff.description).toMatch(/expands radially/i)
    expect(cuff.safety).toMatch(/never be used with the cuff inflated/i)
    expect(cuff.safety).toMatch(/does not completely prevent aspiration/i)
  })

  test('unknown component ids fall back to the complete model copy', () => {
    expect(getTracheostomyPart('missing' as never).id).toBe('whole')
  })
})
