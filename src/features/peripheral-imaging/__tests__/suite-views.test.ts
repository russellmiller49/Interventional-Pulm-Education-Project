import { peripheralImagingSectionIds } from '../content/pathway'
import { SUITE_VIEWS } from '../content/suiteViews'

describe('the suite view each section opens on', () => {
  it('shows the monitor in every section, whether or not it has controls', () => {
    // What the monitor shows is set by the suite mode — a projection, a teaching plane — not by
    // whether the section has a lab. It was once hidden whenever a section had none, which left the
    // sort sections with a full-width scene, an empty dock and no image at all.
    for (const id of peripheralImagingSectionIds) {
      expect({ id, monitor: SUITE_VIEWS[id].monitor }).not.toEqual({ id, monitor: 'hidden' })
    }
  })

  it('never lights the display stop while hiding the display', () => {
    const lit = peripheralImagingSectionIds.filter((id) => SUITE_VIEWS[id].litStop === 'display')
    expect(lit.length).toBeGreaterThan(0)
    for (const id of lit)
      expect({ id, monitor: SUITE_VIEWS[id].monitor }).not.toEqual({ id, monitor: 'hidden' })
  })

  it('binds no control in a section that has no lab', () => {
    for (const id of peripheralImagingSectionIds) {
      const view = SUITE_VIEWS[id]
      if (!view.lab) expect({ id, bindings: view.bindings }).toEqual({ id, bindings: [] })
    }
  })
})
