import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render } from '@testing-library/react'

import { BronchFindControl } from '../components/stage/BronchFindControl'
import {
  FIND_FRAME_IDS,
  findFrame,
  findFrameErrors,
  markerClock,
  markerNames,
} from '../content/findFrames'
import { NUMBER_REGISTER } from '../content/numbers'
import { publishBlockers, sectionNumberIds } from '../content/sectionNumbers'
import { bronchSection } from '../content/sections'
import { section as bleedingPriorities } from '../content/sections/bleeding-priorities'
import { section as rightSide } from '../content/sections/right-side'
import type { BronchFind } from '../content/types'

/**
 * The rewrite pilot (the right lung and bleeding): the click-on-image questions, the case that
 * evolves, the numbers each section takes from the register, and the faculty gate on them.
 */
afterEach(cleanup)

const PUBLIC = join(__dirname, '../../../../public')

function imagesOf(section: typeof rightSide): BronchFind {
  const act = section.moreActs?.images
  if (!act || act.kind !== 'find') throw new Error('The right lung has no image set.')
  return act.find
}

describe('the click-on-image frames', () => {
  it('ship every frame file, with at least two outlines each', () => {
    for (const id of FIND_FRAME_IDS) {
      const frame = findFrame(id)
      expect(existsSync(join(PUBLIC, frame.src))).toBe(true)
      expect(frame.markers.length).toBeGreaterThanOrEqual(2)
      for (const marker of frame.markers) expect(marker.points.length).toBeGreaterThanOrEqual(6)
    }
  })

  it('name each outline by where it is, never by what it is, and turn with the frame', () => {
    const frame = findFrame('right-basal')
    const names = [...markerNames(frame).values()]
    expect(new Set(names).size).toBe(frame.markers.length)
    for (const name of names) expect(name).toMatch(/^Opening [A-D], at \d{1,2} o’clock$/)
    const rb7 = frame.markers.find((marker) => marker.id === 'rb7')!
    const upright = markerClock(frame, rb7)
    expect(markerClock(frame, rb7, 90)).toBe(((upright + 3 - 1) % 12) + 1)
  })

  it('refuse a question about a frame or an opening that does not exist', () => {
    expect(findFrameErrors('row', { frameId: 'nowhere', targetId: 'rb1' })[0]).toMatch(
      /unknown frame/,
    )
    expect(findFrameErrors('row', { frameId: 'carina', targetId: 'rb6' })[0]).toMatch(
      /does not outline/,
    )
  })
})

describe('the right lung’s six views', () => {
  const find = imagesOf(rightSide)

  it('are six, one of them rotated, each saying where the scope came from', () => {
    expect(find.rows).toHaveLength(6)
    expect(find.rows.filter((row) => row.rotation)).toHaveLength(1)
    for (const row of find.rows) {
      expect(findFrameErrors(row.id, row)).toEqual([])
      expect(row.context).toMatch(/^You /)
    }
  })

  function mount(answers: Record<string, string> = {}) {
    const onAnswer = jest.fn()
    render(<BronchFindControl find={find} answers={answers} onAnswer={onAnswer} />)
    return onAnswer
  }

  it('ask with outlines only: no airway name is on the page or in an accessible name', () => {
    mount()
    const first = find.rows[0]
    const frame = findFrame(first.frameId)
    const outlines = [...document.querySelectorAll('[data-find-marker]')]
    expect(outlines).toHaveLength(frame.markers.length)
    for (const outline of outlines) {
      expect(outline.getAttribute('role')).toBe('button')
      expect(outline.getAttribute('tabindex')).toBe('0')
      expect(outline.getAttribute('aria-label')).toMatch(/^Opening [A-Z], at/)
    }
    expect(document.querySelector('[data-find-label]')).toBeNull()
    expect(document.querySelector('[data-find-prompt]')?.textContent).toBe(first.prompt)
    expect(document.querySelector('img')?.getAttribute('alt')).not.toMatch(/left main/i)
  })

  it('take the click as the answer, by mouse or keyboard', () => {
    const onAnswer = mount()
    fireEvent.click(document.querySelector('[data-find-marker="lmb"]')!)
    expect(onAnswer).toHaveBeenLastCalledWith('carina', 'lmb')
    fireEvent.keyDown(document.querySelector('[data-find-marker="rmb"]')!, { key: 'Enter' })
    expect(onAnswer).toHaveBeenLastCalledWith('carina', 'rmb')
  })

  it('then name every opening, mark the one asked for and say why', () => {
    // The set opens on the first image still to answer; step back to the answered one.
    mount({ carina: 'lmb' })
    expect(document.querySelector('[data-find-position]')?.textContent).toBe('Image 2 of 6')
    fireEvent.click(document.querySelector('[data-find-previous]')!)
    const verdict = document.querySelector('[data-find-verdict]')!
    expect(verdict.getAttribute('data-find-verdict')).toBe('other')
    expect(verdict.textContent).toContain('Not correct.')
    expect(verdict.textContent).toContain('You clicked Left main bronchus.')
    expect(verdict.textContent).toContain(find.rows[0].rationale)
    expect(document.querySelector('[data-find-marker="rmb"]')?.getAttribute('data-state')).toBe(
      'target',
    )
    expect(document.querySelector('[data-find-marker="lmb"]')?.getAttribute('data-state')).toBe(
      'chosen',
    )
    expect([...document.querySelectorAll('[data-find-label]')].map((n) => n.textContent)).toEqual([
      'Left main',
      'Right main',
    ])
    // An answered image cannot be answered again.
    expect(document.querySelector('[data-find-marker="rmb"]')?.getAttribute('role')).toBe('img')
  })

  it('show one image at a time and turn the rotated one, outlines and all', () => {
    const answers = Object.fromEntries(find.rows.slice(0, 5).map((row) => [row.id, row.targetId]))
    mount(answers)
    const rotated = find.rows[5]
    expect(document.querySelector('[data-find-position]')?.textContent).toBe('Image 6 of 6')
    expect(document.querySelector('[data-find-row]')?.getAttribute('data-find-rotation')).toBe(
      String(rotated.rotation),
    )
    const turned = document.querySelector<HTMLElement>('[data-find-frame] > div')!
    expect(turned.style.transform).toContain(`rotate(${rotated.rotation}deg)`)
    expect(turned.querySelector('svg')).not.toBeNull()
    fireEvent.click(document.querySelector('[data-find-previous]')!)
    expect(document.querySelector('[data-find-position]')?.textContent).toBe('Image 5 of 6')
    expect(document.querySelector('[data-find-verdict]')?.getAttribute('data-find-verdict')).toBe(
      'held',
    )
  })
})

describe('the bleeding case', () => {
  const act = bleedingPriorities.act
  if (act.kind !== 'scenario') throw new Error('Bleeding has no case.')
  const { frames } = act.scenario

  it('is one patient through four frames, each with its time and its numbers', () => {
    expect(frames).toHaveLength(4)
    for (const frame of frames) {
      expect(frame.time).toBeTruthy()
      const oximetry = frame.readings.find((reading) => reading.channel === 'oximetry')
      expect(oximetry).toMatchObject({ unit: '%', provenance: 'authored' })
      expect(Number(oximetry?.value)).toBeGreaterThan(70)
    }
  })

  it('plays out every move that is not the first move, with the monitor worse than before', () => {
    for (const frame of frames) {
      const before = Number(frame.readings.find((r) => r.channel === 'oximetry')?.value)
      for (const choice of frame.choices) {
        if (choice.plausibility === 'best') {
          expect(choice.consequence).toBeUndefined()
          continue
        }
        const after = Number(
          choice.consequence?.readings.find((r) => r.channel === 'oximetry')?.value,
        )
        expect(choice.consequence?.situation.length).toBeGreaterThan(20)
        expect(after).toBeLessThan(before)
      }
    }
  })

  it('flags as unsafe only the move that gives up the scope’s position', () => {
    const unsafe = frames.flatMap((frame) =>
      frame.choices.filter((choice) => choice.plausibility === 'unsafe').map((c) => c.label),
    )
    expect(unsafe).toEqual([
      'Pull the scope back to the carina for a clear view',
      'Withdraw a little to check whether it has stopped',
      'Remove the scope so she can cough it clear',
    ])
  })
})

describe('the numbers the pilot teaches', () => {
  it('come from the register: the right lung uses none, bleeding the grades and one local slot', () => {
    expect(sectionNumberIds(rightSide)).toEqual([])
    expect([...sectionNumberIds(bleedingPriorities)].sort()).toEqual([
      'nashville-grade-1',
      'nashville-grade-2',
      'nashville-grade-3',
      'nashville-grade-4',
      'topical-vasoconstrictor',
    ])
  })

  it('reach the learner as their values, with one source line on the card', () => {
    const card = bronchSection('bleeding-priorities').blocks.find(
      (block) => block.id === 'nashville',
    )!
    expect(card.points?.[0]).toBe(`Grade 1: ${NUMBER_REGISTER['nashville-grade-1'].value}.`)
    expect(JSON.stringify(bronchSection('bleeding-priorities'))).not.toContain('{{num:')
    expect(card.numberIds).toHaveLength(4)
    const firstMoves = bronchSection('bleeding-priorities').blocks.find(
      (block) => block.role === 'first-moves',
    )!
    expect(firstMoves.steps?.[3]).toBe(
      'Instil a topical vasoconstrictor: the agent and concentration in your local protocol.',
    )
  })

  it('hold publication until faculty has signed every row the pilot uses', () => {
    expect(publishBlockers('unlisted-preview', [rightSide, bleedingPriorities])).toEqual([])
    const blockers = publishBlockers('published', [rightSide, bleedingPriorities])
    expect(blockers).toHaveLength(5)
    for (const blocker of blockers) expect(blocker).toMatch(/^bleeding-priorities uses "/)
  })
})
