import { bronchMicroCaseById } from '../content/microCases'
import { bronchSection } from '../content/pathway'

/**
 * The rewrite plan's clean-up of the practice questions the section rewrites left standing: a stem
 * that named its own answer, a key that left out the step that makes it safe, and a key that
 * stated the diagnosis in place of the first moves.
 */
const practice = (id: string) => {
  const microCase = bronchMicroCaseById.get(id)
  if (!microCase) throw new Error(`No practice case ${id}`)
  const key = microCase.stage.item.choices.find(
    (choice) => choice.id === microCase.stage.item.correctChoiceIds[0],
  )!
  return { situation: microCase.situation, key: key.label, item: microCase.stage.item }
}

describe('the practice clean-up', () => {
  it('no longer names the answer in the stem of the two questions the plan lists', () => {
    // The lavage site is read from where the lesion lies, not from a segment's name.
    const site = practice('mc-lavage-site-selection')
    expect(site.situation).not.toMatch(/\b(posterior|apical|anterior|superior) segment\b/i)
    expect(site.item.choices.map((choice) => choice.label).sort()).toEqual([
      'RB1',
      'RB2',
      'RB3',
      'RB6',
    ])
    // The found scope is not described with the key's own word.
    const scope = practice('mc-unreleased-scope')
    expect(scope.key).toMatch(/reprocessing/)
    expect(scope.situation).not.toMatch(/reprocess|released?/i)
  })

  it('keys the first moves, with the step that makes each safe', () => {
    expect(practice('mc-toxicity-recognition').key).toBe(
      'No more lidocaine, oxygen on, and send for the toxicity kit',
    )
    const lost = bronchSection('view-loss').transfer
    expect(lost.choices.find((choice) => choice.plausibility === 'best')?.label).toBe(
      'See the brush sheathed, then withdraw to the last airway you named',
    )
    expect(practice('mc-sedation-depth').item.stem).toBe('What do you do next?')
    expect(practice('mc-time-out-side-discrepancy').key).not.toMatch(/^(stop|pause|wait)\b/i)
  })

  it('puts the reader in the room in every practice situation', () => {
    for (const [id, microCase] of bronchMicroCaseById)
      expect([
        id,
        /\b(simulation station|the trainees?|the fellow)\b/i.test(microCase.situation),
      ]).toEqual([id, false])
  })
})
