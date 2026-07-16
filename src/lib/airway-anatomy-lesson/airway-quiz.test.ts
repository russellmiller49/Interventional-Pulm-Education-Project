import type { QuizFramesData } from './airway-quiz'
import { buildIdentifyQuestion, quizPoolOf } from './airway-quiz'

const baseStructure = {
  img: '/x.jpg',
  frame: 1,
  poly: [0, 0, 10, 0, 10, 10, 0, 10],
  short: 'X',
  isOrifice: true,
  hasCt: true,
}

const data: QuizFramesData = {
  meta: { width: 100, height: 100, note: 'test' },
  structures: {
    rb1: { ...baseStructure, name: 'RB1', lobe: 'RUL', group: 'RUL' },
    rb2: { ...baseStructure, name: 'RB2', lobe: 'RUL', group: 'RUL' },
    rb3: { ...baseStructure, name: 'RB3', lobe: 'RUL', group: 'RUL' },
    rb6: { ...baseStructure, name: 'RB6', lobe: 'RLL', group: 'RLL' },
    lb1: { ...baseStructure, name: 'LB1', lobe: 'LUL', group: 'LUL' },
    lb2: { ...baseStructure, name: 'LB2', lobe: 'LUL', group: 'LUL' },
  },
}

describe('airway identify quiz helpers', () => {
  it('excludes LB1/LB2 from endoscopic still testing', () => {
    const pool = quizPoolOf(data)
    expect(pool).toEqual(expect.arrayContaining(['rb1', 'rb2', 'rb3', 'rb6']))
    expect(pool).not.toContain('lb1')
    expect(pool).not.toContain('lb2')
  })

  it('builds a target plus unique answer options', () => {
    const question = buildIdentifyQuestion(data, [], () => 0.1)
    expect(question).not.toBeNull()
    expect(question!.options).toContain(question!.target)
    expect(new Set(question!.options).size).toBe(question!.options.length)
  })
})
