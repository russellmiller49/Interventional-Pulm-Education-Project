import { scoreSequence } from '../engine/sequencing'

const correct = ['a', 'b', 'c', 'd']

describe('scoreSequence', () => {
  it('marks a fully correct order as passed with no error index', () => {
    const score = scoreSequence(['a', 'b', 'c', 'd'], correct)
    expect(score).toEqual({
      correctPositions: 4,
      total: 4,
      firstErrorIndex: null,
      passed: true,
    })
  })

  it('reports the first out-of-place position', () => {
    const score = scoreSequence(['a', 'c', 'b', 'd'], correct)
    expect(score.correctPositions).toBe(2) // a and d are in place
    expect(score.firstErrorIndex).toBe(1)
    expect(score.passed).toBe(false)
  })

  it('penalizes an early insertion that shifts every later step', () => {
    // Moving 'd' to the front shifts a/b/c down by one — nothing else matches.
    const score = scoreSequence(['d', 'a', 'b', 'c'], correct)
    expect(score.correctPositions).toBe(0)
    expect(score.firstErrorIndex).toBe(0)
    expect(score.passed).toBe(false)
  })

  it('does not pass a reversed order', () => {
    const score = scoreSequence(['d', 'c', 'b', 'a'], correct)
    expect(score.passed).toBe(false)
    expect(score.firstErrorIndex).toBe(0)
  })

  it('flags a learner order longer than the target as an error', () => {
    const score = scoreSequence(['a', 'b', 'c', 'd', 'e'], correct)
    expect(score.correctPositions).toBe(4)
    expect(score.firstErrorIndex).toBe(4)
    expect(score.passed).toBe(false)
  })

  it('does not pass a learner order shorter than the target', () => {
    const score = scoreSequence(['a', 'b', 'c'], correct)
    expect(score.correctPositions).toBe(3)
    expect(score.passed).toBe(false)
  })
})
