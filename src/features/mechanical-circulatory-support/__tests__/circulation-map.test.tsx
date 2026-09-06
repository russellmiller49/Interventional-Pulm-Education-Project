/**
 * The circulation map: one geometry, every segment drawn, the answer a real radio group.
 */
import { fireEvent, render } from '@testing-library/react'

import {
  CirculationMap,
  orderAnswerOptionsAlongPath,
} from '../components/circulation-map/CirculationMap'
import {
  CIRCULATION_MAP_PATH_ORDER,
  CIRCULATION_MAP_PATHWAYS,
  CIRCULATION_MAP_SEGMENTS,
  CIRCULATION_MAP_VIEW_BOX,
  circulationMapSegment,
} from '../components/circulation-map/circulationMapGeometry'
import { mcsMapAnswerTargets } from '../content/mapAnswerTargets'
import { mcsSectionLearningContractById } from '../content/sectionLearningContracts'
import { mcsMapPathwayIds, mcsMapSegmentIds } from '../content/supportSpine'
import { createInitialMcsState, mcsReducer } from '../engine'

describe('the geometry', () => {
  it('draws every segment the spine names, once, inside the view box', () => {
    expect(CIRCULATION_MAP_SEGMENTS.map((segment) => segment.id).sort()).toEqual(
      [...mcsMapSegmentIds].sort(),
    )
    expect(CIRCULATION_MAP_PATH_ORDER).toHaveLength(mcsMapSegmentIds.length)
    for (const segment of CIRCULATION_MAP_SEGMENTS) {
      expect(segment.pinAt.x).toBeGreaterThan(0)
      expect(segment.pinAt.x).toBeLessThan(CIRCULATION_MAP_VIEW_BOX.width)
      expect(segment.pinAt.y).toBeGreaterThan(0)
      expect(segment.pinAt.y).toBeLessThan(CIRCULATION_MAP_VIEW_BOX.height)
    }
    expect(CIRCULATION_MAP_PATHWAYS.map((pathway) => pathway.id).sort()).toEqual(
      [...mcsMapPathwayIds].sort(),
    )
  })

  it('keeps every pin far enough from every other to aim at', () => {
    const pins = CIRCULATION_MAP_SEGMENTS.map((segment) => segment.pinAt)
    for (let a = 0; a < pins.length; a += 1) {
      for (let b = a + 1; b < pins.length; b += 1) {
        const distance = Math.hypot(pins[a].x - pins[b].x, pins[a].y - pins[b].y)
        expect(distance).toBeGreaterThan(44)
      }
    }
  })
})

describe('the drawing', () => {
  it('draws the pathway for the mechanism on screen, in place or not', () => {
    const impella = createInitialMcsState('learn', 'impella')
    const { container, rerender } = render(<CirculationMap state={impella} />)
    expect(container.querySelector('[data-map-pathway="left-pump"]')).toHaveAttribute(
      'data-map-pathway-in-place',
      'true',
    )
    expect(container.querySelector('[data-map-pathway="right-pump"]')).toHaveAttribute(
      'data-map-pathway-in-place',
      'false',
    )
    expect(container.querySelector('desc')?.textContent).toContain('drawn but not in place')
    const withRight = mcsReducer(impella, {
      type: 'SET_IMPELLA_CONFIGURATION',
      control: 'rightEnabled',
      value: true,
    })
    rerender(<CirculationMap state={withRight} />)
    expect(container.querySelector('[data-map-pathway="right-pump"]')).toHaveAttribute(
      'data-map-pathway-in-place',
      'true',
    )
    rerender(<CirculationMap state={createInitialMcsState('learn', 'iabp')} />)
    expect(container.querySelectorAll('[data-map-pathway]')).toHaveLength(1)
    expect(container.querySelector('[data-map-pathway="iabp-balloon"]')).toBeInTheDocument()
    rerender(<CirculationMap state={createInitialMcsState('learn', 'lvad')} />)
    expect(container.querySelector('[data-map-pathway="durable-pump"]')).toBeInTheDocument()
  })

  it('lights the emphasised segments on the drawing and says so in words and in the description', () => {
    const { container } = render(
      <CirculationMap
        state={createInitialMcsState('learn', 'iabp')}
        emphasis={{
          segmentIds: ['left-ventricle', 'aortic-valve'],
          caption: 'You are here: The left ventricle.',
          tone: 'you-are-here',
        }}
      />,
    )
    expect(
      [...container.querySelectorAll('[data-map-emphasis-target]')].map((n) =>
        n.getAttribute('data-map-emphasis-target'),
      ),
    ).toEqual(['left-ventricle', 'aortic-valve'])
    expect(container.querySelector('[data-map-emphasis-caption]')?.textContent).toBe(
      'You are here: The left ventricle.',
    )
    expect(container.querySelector('desc')?.textContent).toContain(
      'You are here: The left ventricle.',
    )
  })
})

describe('the answer on the map', () => {
  const sectionId = 'impella-suction-purge-rv'
  const contract = mcsSectionLearningContractById.get(sectionId)!
  const targets = mcsMapAnswerTargets(sectionId)!
  const options = contract.recognizeOptions.map((option) => ({
    id: option.id,
    label: option.label,
    segmentIds: targets.find((target) => target.optionId === option.id)!.segmentIds,
  }))
  const state = createInitialMcsState('learn', 'impella')

  function renderAnswer(selected: string | null, committed: string | null, onSelect = jest.fn()) {
    return {
      onSelect,
      ...render(
        <CirculationMap
          state={state}
          answer={{
            prompt: contract.recognizePrompt,
            options,
            selectedOptionId: selected,
            committedOptionId: committed,
            correctOptionId: 'returns-to-pa',
            name: 'map-test',
            onSelect,
          }}
        />,
      ),
    }
  }

  it('numbers the options along the blood path and offers one radio per option, both from the row and from the pin', () => {
    const { container, onSelect } = renderAnswer(null, null)
    const ordered = orderAnswerOptionsAlongPath(options)
    expect(ordered.map((option) => option.id)).toEqual([
      'returns-to-ra',
      'returns-to-pa',
      'returns-to-aorta',
    ])
    const radios = container.querySelectorAll(
      'fieldset[data-prediction-choices] input[type="radio"]',
    )
    expect(radios).toHaveLength(3)
    expect([...radios].every((radio) => radio.getAttribute('name') === 'map-test')).toBe(true)
    fireEvent.click(container.querySelector('[data-map-pin-target="returns-to-pa"]') as HTMLElement)
    expect(onSelect).toHaveBeenCalledWith('returns-to-pa')
    fireEvent.click(
      container.querySelector('[data-map-answer-row="returns-to-aorta"] input') as HTMLElement,
    )
    expect(onSelect).toHaveBeenCalledWith('returns-to-aorta')
    // The pins over the drawing count as the answer control for the pre-commitment scan.
    expect(container.querySelector('[data-map-pin-targets]')).toHaveAttribute(
      'data-prediction-choices',
    )
  })

  it('says nothing about correctness before the commitment, and marks in words after it', () => {
    const { container, rerender } = renderAnswer('returns-to-aorta', null)
    expect(container.querySelector('[data-map-answer-marking-label]')).toBeNull()
    expect(container.querySelector('[data-map-pin-marking]')).toBeNull()
    expect(container.querySelector('fieldset[data-prediction-choices]')).not.toBeDisabled()
    rerender(
      <CirculationMap
        state={state}
        answer={{
          prompt: contract.recognizePrompt,
          options,
          selectedOptionId: 'returns-to-aorta',
          committedOptionId: 'returns-to-aorta',
          correctOptionId: 'returns-to-pa',
          name: 'map-test',
          onSelect: jest.fn(),
        }}
      />,
    )
    expect(container.querySelector('fieldset[data-prediction-choices]')).toBeDisabled()
    expect(container.querySelector('[data-map-answer-row="returns-to-aorta"]')).toHaveAttribute(
      'data-map-answer-marking',
      'your-answer',
    )
    expect(container.querySelector('[data-map-answer-row="returns-to-pa"]')).toHaveAttribute(
      'data-map-answer-marking',
      'correct',
    )
    expect(
      container.querySelector(
        '[data-map-answer-row="returns-to-pa"] [data-map-answer-marking-label]',
      )?.textContent,
    ).toBe('Correct')
    expect(container.querySelector('[data-map-pin="returns-to-pa"]')).toHaveAttribute(
      'data-map-pin-marking',
      'correct',
    )
  })

  it('hides a pathway that is not in place while a place is the question', () => {
    const { container, rerender } = renderAnswer(null, null)
    expect(container.querySelector('[data-map-pathway="right-pump"]')).toBeNull()
    expect(container.querySelector('[data-map-pathway="left-pump"]')).toBeInTheDocument()
    rerender(
      <CirculationMap
        state={state}
        answer={{
          prompt: '',
          options,
          selectedOptionId: 'returns-to-pa',
          committedOptionId: 'returns-to-pa',
          correctOptionId: 'returns-to-pa',
          name: 'map-test',
          onSelect: jest.fn(),
        }}
      />,
    )
    expect(container.querySelector('[data-map-pathway="right-pump"]')).toBeInTheDocument()
  })

  it('puts every pin on its own segment', () => {
    for (const option of options) {
      const segment = circulationMapSegment(option.segmentIds[0])
      expect(segment.id).toBe(option.segmentIds[0])
    }
  })
})
