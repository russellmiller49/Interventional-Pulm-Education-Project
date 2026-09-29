/** @jest-environment node */
import { PROTOTYPE_WORDS } from '../components/prototype/SpacePrototype'
import { outcomeStanding } from '../engine/space/outcomes'

/**
 * Owner decision OD-11: until the lung-change claim is clinically reviewed, the space prototype
 * shows the lung's fallen-away state as an authored teaching state it plays, labelled so, and never
 * as a physiological consequence of the learner's own action.
 */
describe('the space prototype’s lung change', () => {
  it('is offered as an authored teaching state, not as the learner letting air in', () => {
    expect(PROTOTYPE_WORDS.authoredHeading).toBe('Authored teaching state')
    expect(PROTOTYPE_WORDS.letAirIn).toMatch(/authored/i)
    expect(PROTOTYPE_WORDS.letAirIn).not.toMatch(/let air in/i)
    expect(PROTOTYPE_WORDS.airIn).toMatch(/authored teaching state/i)
  })

  it('says it is not a response to the learner, not physiology, and not reviewed', () => {
    expect(PROTOTYPE_WORDS.lungLabel).toMatch(/not a response to anything you do/)
    expect(PROTOTYPE_WORDS.lungLabel).toMatch(/not a simulation of how a lung behaves/)
    expect(PROTOTYPE_WORDS.lungLabel).toMatch(/not been clinically reviewed/)
    // the label shows while the relationship awaits review
    expect(outcomeStanding('lung-falls-away').kind).toBe('authored-awaiting-review')
  })
})
