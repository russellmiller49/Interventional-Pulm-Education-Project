import type { SpaceEngineStart } from '../../components/space/useSpaceEngine'
import type { TeachingExampleId } from '../../content/teachingExamples'

/**
 * The engine's values for each teaching example's words (`content/teachingExamples.ts`): the lung
 * at its last step, having fallen away, and the telescope's tip just inside the pleural space, a
 * few millimetres past the end of its sleeve, pointing along the port's corridor. Authored.
 */
const LAST_LUNG_STEP = 8

export function exampleStart(id: TeachingExampleId): SpaceEngineStart {
  switch (id) {
    case 'space-made':
      return {
        scenario: `example:${id}`,
        lungStep: LAST_LUNG_STEP,
        pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 12, rollDeg: 0 },
      }
  }
}
