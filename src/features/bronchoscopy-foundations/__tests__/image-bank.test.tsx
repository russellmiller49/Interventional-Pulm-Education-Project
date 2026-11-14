import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { BronchImageBank } from '../components/BronchImageBank'
import { BronchoscopyFoundationsPracticeLanding } from '../components/BronchoscopyFoundationsPracticeLanding'
import { findFrame } from '../content/findFrames'
import {
  IMAGE_BANK_ROWS,
  IMAGE_BANK_SET_SIZE,
  IMAGE_BANK_SETS,
  imageBankSet,
} from '../content/imageBank'
import { imageBankErrors } from '../content/imageBankRules'
import { BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE } from '../content/release'
import { imageShareBlockers, publishBlockers } from '../content/sectionNumbers'
import { BRONCH_SECTIONS } from '../content/sections'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> }
    children: React.ReactNode
  }) => (
    <a
      href={
        typeof href === 'string'
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      }
      {...rest}
    >
      {children}
    </a>
  ),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const opening = (row: (typeof IMAGE_BANK_ROWS)[number]) => `${row.frameId}/${row.targetId}`

describe('the image bank', () => {
  it('holds every question to the copy rules and to a real outline', () => {
    expect(imageBankErrors()).toEqual([])
  })

  it('asks each opening once upright and once rotated, in different sets', () => {
    expect(IMAGE_BANK_ROWS).toHaveLength(50)
    expect(IMAGE_BANK_SETS.map((rows) => rows.length)).toEqual(
      IMAGE_BANK_SETS.map(() => IMAGE_BANK_SET_SIZE),
    )
    const upright = IMAGE_BANK_ROWS.filter((row) => row.rotation === undefined)
    const turned = IMAGE_BANK_ROWS.filter((row) => row.rotation !== undefined)
    expect(upright.map(opening).sort()).toEqual(turned.map(opening).sort())
    expect(new Set(upright.map(opening)).size).toBe(upright.length)
    const setOf = (row: (typeof IMAGE_BANK_ROWS)[number]) =>
      IMAGE_BANK_SETS.findIndex((rows) => rows.includes(row))
    for (const row of upright) {
      const twin = turned.find((entry) => opening(entry) === opening(row))!
      expect([opening(row), setOf(twin) === setOf(row)]).toEqual([opening(row), false])
    }
    // Each set draws on both lungs.
    for (const rows of IMAGE_BANK_SETS) {
      const lungs = new Set(rows.map((row) => (/^(left|lingula)/.test(row.frameId) ? 'L' : 'R')))
      expect(lungs.size).toBe(2)
    }
  })

  it('says where the scope is, and turns the orientation cue with the picture', () => {
    for (const row of IMAGE_BANK_ROWS) {
      expect(row.context).toMatch(/^You /)
      expect(Boolean(row.rotation)).toBe(/The view is rotated/.test(row.context))
      // The opening asked for is outlined on its frame, beside at least one other.
      const frame = findFrame(row.frameId)
      expect(frame.markers.some((marker) => marker.id === row.targetId)).toBe(true)
      expect(frame.markers.length).toBeGreaterThan(1)
    }
    const context = (frameId: string, rotation?: number) =>
      IMAGE_BANK_ROWS.find((row) => row.frameId === frameId && row.rotation === rotation)?.context
    expect(context('carina')).toContain('The membranous wall is at 7 o’clock.')
    for (const [rotation, hour] of [
      [90, 10],
      [180, 1],
      [270, 4],
    ] as const) {
      const turned = context('carina', rotation)
      if (turned) expect(turned).toContain(`The membranous wall is at ${hour} o’clock.`)
    }
    // A cue on the left of the upright view is at the top after a quarter turn clockwise.
    for (const [rotation, words] of [
      [90, 'toward the top'],
      [180, 'to the right'],
      [270, 'toward the bottom'],
    ] as const) {
      const turned = context('right-upper-lobe', rotation)
      if (turned) expect(turned).toContain(`Anterior is ${words} of this view.`)
    }
    expect(context('right-upper-lobe')).toContain('Anterior is to the left of this view.')
  })

  it('counts toward the share of questions that show an image', () => {
    expect(imageShareBlockers(BRONCH_SECTIONS)).toHaveLength(1)
    expect(imageShareBlockers(BRONCH_SECTIONS, IMAGE_BANK_ROWS.length)).toEqual([])
    expect(
      publishBlockers(
        BRONCHOSCOPY_FOUNDATIONS_RELEASE_STAGE,
        BRONCH_SECTIONS,
        IMAGE_BANK_ROWS.length,
      ),
    ).toEqual([])
  })

  it('takes the first click as the answer, then offers the next set, and keeps nothing', () => {
    render(<BronchImageBank set={1} />)
    const find = imageBankSet(1)!
    expect(screen.getByRole('heading', { name: 'Find the opening' })).toBeVisible()
    expect(document.querySelector('[data-image-bank-finished]')).toBeNull()
    find.rows.forEach((row, index) => {
      expect(document.querySelector('[data-find-position]')).toHaveTextContent(
        `Image ${index + 1} of ${find.rows.length}`,
      )
      expect(document.body).toHaveTextContent(row.context)
      // Miss the first picture on purpose; the second click on it changes nothing.
      const other = findFrame(row.frameId).markers.find((marker) => marker.id !== row.targetId)!
      const clicked = index === 0 ? other.id : row.targetId
      fireEvent.click(document.querySelector(`[data-find-marker="${clicked}"]`)!)
      const verdict = document.querySelector('[data-find-verdict]')!
      expect(verdict).toHaveAttribute('data-find-verdict', index === 0 ? 'other' : 'held')
      expect(verdict).toHaveTextContent(row.rationale)
      fireEvent.click(document.querySelector(`[data-find-marker="${row.targetId}"]`)!)
      expect(document.querySelector('[data-find-verdict]')).toHaveAttribute(
        'data-find-verdict',
        index === 0 ? 'other' : 'held',
      )
      if (index < find.rows.length - 1) fireEvent.click(document.querySelector('[data-find-next]')!)
    })
    const finished = document.querySelector('[data-image-bank-finished]')!
    expect(finished.querySelector('[data-image-bank-next]')).toHaveAttribute(
      'href',
      '/bronchoscopy-foundations/practice/images?set=2',
    )
    fireEvent.click(finished.querySelector('[data-image-bank-again]')!)
    expect(document.querySelector('[data-image-bank-finished]')).toBeNull()
    expect(document.querySelector('[data-find-position]')).toHaveTextContent('Image 1 of 10')
    expect(document.querySelector('[data-find-verdict]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\bscore|\bpoints\b|streak/i)
    expect(localStorage.length).toBe(0)
  })

  it('loops from the last set back to the first, and renders nothing for a set that is not there', () => {
    const last = IMAGE_BANK_SETS.length
    render(<BronchImageBank set={last} />)
    expect(document.querySelector(`[data-image-bank-set-link="${last}"]`)).toHaveAttribute(
      'aria-current',
      'page',
    )
    cleanup()
    const { container } = render(<BronchImageBank set={last + 1} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is one link on the Practice landing, apart from the cases', () => {
    render(<BronchoscopyFoundationsPracticeLanding />)
    const link = document.querySelector('[data-practice-image-bank-link]')!
    expect(link).toHaveAttribute('href', '/bronchoscopy-foundations/practice/images')
    expect(link).toHaveTextContent(`${IMAGE_BANK_ROWS.length} views from both lungs`)
    expect(link).not.toHaveAttribute('data-practice-case-link')
    expect(document.querySelectorAll('[data-practice-continue]')).toHaveLength(1)
  })
})
