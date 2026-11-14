/**
 * @jest-environment node
 */
import { CORD_MORPH_WEIGHT, drawnCordWeight } from '../components/scope/scopeSceneModel'

describe('how far the true folds are drawn closed', () => {
  it('draws the folds as they are while the scope is above the glottis', () => {
    expect(drawnCordWeight('abducted', false)).toBe(CORD_MORPH_WEIGHT.abducted)
    expect(drawnCordWeight('narrowing', false)).toBe(CORD_MORPH_WEIGHT.narrowing)
    // Fully closed: the picture the learner must wait out before crossing.
    expect(drawnCordWeight('adducted', false)).toBe(1)
  })

  it('closes them onto the scope, not through it, once the scope is through', () => {
    expect(drawnCordWeight('abducted', true)).toBe(CORD_MORPH_WEIGHT.abducted)
    expect(drawnCordWeight('narrowing', true)).toBe(CORD_MORPH_WEIGHT.narrowing)
    // Shut folds leave the scope its place between them, so the view below is never one blank
    // colour from a camera sitting inside the folds.
    expect(drawnCordWeight('adducted', true)).toBe(CORD_MORPH_WEIGHT.narrowing)
    expect(drawnCordWeight('adducted', true)).toBeLessThan(1)
  })
})
