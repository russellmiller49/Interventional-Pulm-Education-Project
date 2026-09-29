/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { claimById } from '../content/claimRegister'
import { CONTROL_IDS, CONTROL_PANEL_LABEL, MODEL_CONTROLS } from '../content/controlPanel'
import { MODEL_BOUNDARIES, curriculumSection } from '../content/curriculum'
import { LANDMARKS } from '../content/landmarks'
import { MODEL_BOUNDARY_LIST } from '../content/modelBoundaries'
import { PLEURAL_ZONE_IDS, pleuralZoneList, pleuralZones } from '../content/pleuralZones'
import { TEACHING_EXAMPLES } from '../content/teachingExamples'

type Manifest = {
  controls: { items: string[]; learnerWording: { proposal: string } }
}

const manifest = JSON.parse(
  readFileSync(
    join(process.cwd(), 'docs/medical-thoracoscopy/implementation-manifest.json'),
    'utf8',
  ),
) as Manifest

describe('the control panel', () => {
  it('holds the four controls of the original plan, labelled as controls of the model', () => {
    expect(CONTROL_IDS).toEqual(['port', 'scope', 'tool', 'space'])
    expect(CONTROL_PANEL_LABEL).toBe('Controls of the model')
    expect(MODEL_CONTROLS).toHaveLength(manifest.controls.items.length)
  })

  it('names the second control with the learner wording proposed in the manifest', () => {
    const scope = MODEL_CONTROLS[1]
    const words = `${scope.name} (${scope.parts.map((part) => part.name).join(', ')})`

    expect(words.toLowerCase()).toBe(manifest.controls.learnerWording.proposal)
    expect(MODEL_CONTROLS[3].parts.map((part) => part.name)).toEqual(['Fluid out', 'Air in'])
  })

  it('points each control at the section that teaches it', () => {
    expect(MODEL_CONTROLS.map((control) => curriculumSection(control.taughtIn).number)).toEqual([
      8, 7, 13, 10,
    ])
  })
})

describe('the survey zones', () => {
  it('are an authored construct, and say that no source prescribes them', () => {
    expect(pleuralZoneList.label).toBe('Authored construct')
    expect(pleuralZoneList.statement).toMatch(/chosen for teaching/)
    expect(pleuralZoneList.statement).toMatch(/No source prescribes them/)
    const [construct, ...reasons] = pleuralZoneList.claimIds.map((id) => claimById(id))
    expect(construct.category).toBe('authored simulation assumption')
    expect(construct.shownBeforeReview.learnerLabel).toBe('Authored construct')
    expect(reasons.map((claim) => claim.id)).toEqual(['MT-C-0012', 'MT-C-0023'])
  })

  it('divide the right parietal pleura into seven regions, in the survey order', () => {
    expect(pleuralZones.map((zone) => zone.id)).toEqual([...PLEURAL_ZONE_IDS])
    expect(pleuralZones.map((zone) => zone.surveyOrder)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(pleuralZoneList.side).toBe('right')
    expect(pleuralZoneList.surface).toBe('parietal pleura')
  })

  it('say that the lung surface is not tracked', () => {
    expect(pleuralZoneList.notTracked).toMatch(/lung surface/)
    expect(pleuralZoneList.notTracked).toMatch(/does not keep track/)
  })

  it('put the port in the region the survey takes last', () => {
    expect(pleuralZones.at(-1)?.id).toBe('lateral-chest-wall')
    expect(pleuralZones.at(-1)?.where).toMatch(/port/)
  })
})

describe('landmarks', () => {
  it('each sit in a zone that exists, and say where the model gets them', () => {
    for (const landmark of LANDMARKS) {
      for (const zone of landmark.zones) expect(PLEURAL_ZONE_IDS).toContain(zone)
      expect(['CT segmentation', 'drawn by the author', 'not in this model']).toContain(
        landmark.inThisModel,
      )
    }
  })
})

describe('model boundaries', () => {
  it('reuse the six learner statements, then add the two the scan brings and the model’s own', () => {
    expect(MODEL_BOUNDARY_LIST.slice(0, 6).map((boundary) => boundary.text)).toEqual([
      ...MODEL_BOUNDARIES,
    ])
    expect(MODEL_BOUNDARY_LIST.slice(6).map((boundary) => boundary.from)).toEqual([
      'the scan',
      'the scan',
      'this model',
    ])
    expect(MODEL_BOUNDARY_LIST[6].text).toMatch(/lying on the back/)
    expect(MODEL_BOUNDARY_LIST[7].text).toMatch(/ribs are rigid/)
    expect(MODEL_BOUNDARY_LIST[8].text).toMatch(/moves with breathing/)
  })
})

describe('teaching examples', () => {
  it('are labelled, say the learner did not do the steps, and name where the steps are taught', () => {
    for (const example of TEACHING_EXAMPLES) {
      expect(example.label).toBe('Teaching example')
      expect(example.notPerformed).toMatch(/You did not do these steps/)
      expect(example.stepsTaughtIn.map((id) => curriculumSection(id).number)).toEqual([8, 9, 10])
      for (const id of example.claimIds) expect(claimById(id).id).toBe(id)
    }
  })
})
