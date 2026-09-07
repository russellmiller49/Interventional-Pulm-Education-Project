import { STAGE_PANE_NAMES, compactPaneForLocation, stageStepLocationErrors } from '../stageModel'

/**
 * The step-location contract, on the shared model alone.
 *
 * A module validates its own registry with `stageStepLocationErrors` at import; these pin what
 * that validator refuses, so a module cannot author a location that points at nothing.
 */
describe('a step location', () => {
  it('is required, and says so in terms of the pane', () => {
    expect(stageStepLocationErrors('Lesson x step 2', undefined)).toEqual([
      'Lesson x step 2 does not say which pane its work is done in.',
    ])
  })

  it('accepts a pane and a landmark inside it', () => {
    expect(
      stageStepLocationErrors('s', { pane: 'teaching', landmark: 'Lesson narrative' }),
    ).toEqual([])
  })

  it('refuses an empty landmark', () => {
    expect(stageStepLocationErrors('s', { pane: 'steps', landmark: '   ' })).toEqual([
      's names a pane with nothing in it to look at.',
    ])
  })

  it("refuses a pane's own name as the landmark inside it, whatever the case", () => {
    for (const name of Object.values(STAGE_PANE_NAMES)) {
      expect(stageStepLocationErrors('s', { pane: 'simulator', landmark: name })).toEqual([
        's uses a pane name as a landmark inside that pane.',
      ])
      expect(
        stageStepLocationErrors('s', { pane: 'simulator', landmark: name.toUpperCase() }),
      ).toEqual(['s uses a pane name as a landmark inside that pane.'])
    }
  })

  it('accepts a whole second location on a different pane', () => {
    expect(
      stageStepLocationErrors('s', {
        pane: 'simulator',
        landmark: 'the console',
        alsoPane: 'teaching',
        alsoLandmark: 'the channel set',
      }),
    ).toEqual([])
  })

  it('refuses half of a second location', () => {
    expect(
      stageStepLocationErrors('s', {
        pane: 'simulator',
        landmark: 'the console',
        alsoPane: 'teaching',
      }),
    ).toEqual(['s declares half of a second location.'])
    expect(
      stageStepLocationErrors('s', {
        pane: 'simulator',
        landmark: 'the console',
        alsoLandmark: 'the channel set',
      }),
    ).toEqual(['s declares half of a second location.'])
  })

  it('refuses the same pane twice, and a pane name as the second landmark', () => {
    expect(
      stageStepLocationErrors('s', {
        pane: 'steps',
        landmark: 'the answer choices',
        alsoPane: 'steps',
        alsoLandmark: 'the step list',
      }),
    ).toEqual(['s names the same pane twice.'])
    expect(
      stageStepLocationErrors('s', {
        pane: 'steps',
        landmark: 'the answer choices',
        alsoPane: 'teaching',
        alsoLandmark: 'Teaching panel',
      }),
    ).toEqual(['s uses a pane name as a landmark inside that pane.'])
  })
})

describe('the compact pane a location implies', () => {
  it('follows the location, and falls back to the steps', () => {
    expect(compactPaneForLocation({ pane: 'teaching', landmark: 'x' })).toBe('teaching')
    expect(compactPaneForLocation({ pane: 'simulator', landmark: 'x' })).toBe('simulator')
    expect(compactPaneForLocation(undefined)).toBe('steps')
    expect(compactPaneForLocation(undefined, 'simulator')).toBe('simulator')
  })
})
