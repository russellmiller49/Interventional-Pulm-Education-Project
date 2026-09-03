import { readFileSync } from 'node:fs'
import path from 'node:path'

import { assertNoUniversalTargetLanguage } from '@/features/critical-care/test-support/teachingPanelContract'
import { flaggedLearnerCopyTerms } from '@/features/learning-module/activity/clinicalLearningItem'

import {
  ECMO_CONTROL_PANEL,
  ecmoControlKnob,
  ecmoControlKnobIds,
  ecmoLearnerCopyErrors,
  ecmoUniversalTargetPatterns,
  validateEcmoControlPanel,
} from '../content/controlPanel'
import { evidenceById } from '../content/evidence'

/**
 * The small control panel, checked as authored content.
 *
 * The panel's whole value is that it is short and complete: three knobs, an emergency-only pair of
 * clamps, and a sentence saying everything else is monitoring. A fourth knob arriving quietly is
 * the failure this file exists to catch, and after it, copy that turns one of the three into a
 * number to aim at.
 */

function panelStrings(): readonly string[] {
  return [
    ECMO_CONTROL_PANEL.sentence,
    ...ECMO_CONTROL_PANEL.knobs.flatMap((knob) => [
      knob.plainName,
      knob.consoleLabel,
      knob.principallyMoves,
      knob.doesNotMove,
    ]),
    ...ECMO_CONTROL_PANEL.emergencyOnly.flatMap((control) => [control.plainName, control.sentence]),
  ]
}

describe('the ECMO control panel', () => {
  it('validates cleanly at import and by explicit call', () => {
    expect(validateEcmoControlPanel()).toEqual([])
  })

  it('names exactly three knobs, once each, in the order the module teaches them', () => {
    expect([...ecmoControlKnobIds]).toEqual(['pump-speed', 'sweep', 'oxygen-fraction'])
    expect(ECMO_CONTROL_PANEL.knobs.map((knob) => knob.id)).toEqual([...ecmoControlKnobIds])
    for (const id of ecmoControlKnobIds) expect(ecmoControlKnob(id).id).toBe(id)
  })

  it('throws rather than returning undefined for a knob the panel does not have', () => {
    // @ts-expect-error the accessor is typed; the throw protects a cast at a boundary.
    expect(() => ecmoControlKnob('flow-target')).toThrow(/flow-target/)
  })

  it('puts one knob on the blood path and two on the gas path', () => {
    expect(ecmoControlKnob('pump-speed').axis).toBe('blood path')
    expect(ecmoControlKnob('sweep').axis).toBe('gas path')
    expect(ecmoControlKnob('oxygen-fraction').axis).toBe('gas path')
  })

  it('says what each knob is for and, beside it, what it is not for', () => {
    for (const knob of ECMO_CONTROL_PANEL.knobs) {
      expect(knob.principallyMoves.length).toBeGreaterThan(0)
      expect(knob.doesNotMove.length).toBeGreaterThan(0)
      expect(knob.principallyMoves).not.toBe(knob.doesNotMove)
    }
    // The two habitually confused controls are decoupled in the records themselves.
    expect(ecmoControlKnob('pump-speed').principallyMoves).toMatch(/oxygen transfer/i)
    expect(ecmoControlKnob('sweep').principallyMoves).toMatch(/CO₂ clearance/i)
    expect(ecmoControlKnob('oxygen-fraction').doesNotMove).toMatch(/gradient/i)
  })

  it('gives the plain name first and the label the learner sees on the device second', () => {
    for (const knob of ECMO_CONTROL_PANEL.knobs) {
      expect(knob.plainName).not.toBe(knob.consoleLabel)
      expect(knob.consoleLabel.length).toBeGreaterThan(0)
    }
    expect(ecmoControlKnob('pump-speed').consoleLabel).toBe('rpm')
    expect(ecmoControlKnob('oxygen-fraction').consoleLabel).toBe('FiO₂ on the blender')
  })

  it('keeps the clamps off the panel as an emergency control rather than a setting', () => {
    expect(ECMO_CONTROL_PANEL.emergencyOnly.map((control) => control.id)).toEqual(['clamps'])
    const clamps = ECMO_CONTROL_PANEL.emergencyOnly[0]
    expect(clamps.sentence).toMatch(/not a control/i)
    expect(ECMO_CONTROL_PANEL.knobs.map((knob) => knob.id)).not.toContain('clamps')
  })

  it('introduces the panel with one sentence that names all three and closes the set', () => {
    for (const knob of ECMO_CONTROL_PANEL.knobs) {
      expect(ECMO_CONTROL_PANEL.sentence.toLowerCase()).toContain(knob.plainName.toLowerCase())
    }
    expect(ECMO_CONTROL_PANEL.sentence).toMatch(/three things/i)
    expect(ECMO_CONTROL_PANEL.sentence).toMatch(/everything else on the console is monitoring/i)
    expect(ECMO_CONTROL_PANEL.sentence).toMatch(/emergencies only/i)
  })

  it('carries no number anywhere a learner could read one as a setting to aim at', () => {
    for (const value of panelStrings()) expect(value).not.toMatch(/\d/)
  })

  it('carries no reviewed learner-copy term', () => {
    for (const value of panelStrings()) expect(flaggedLearnerCopyTerms(value)).toEqual([])
  })

  it('phrases nothing as a universal bedside target', () => {
    for (const value of panelStrings()) assertNoUniversalTargetLanguage(value)
  })

  /*
   * The mirrored pattern list, held to its original.
   *
   * `teachingPanelContract` calls jest's `expect`, so content cannot import it and the patterns are
   * copied into `controlPanel.ts` for the import-time validators to use. A copy that drifts is a
   * validator that stops checking what it claims to, so the two lists are compared by source here.
   */
  it('mirrors the shared universal-target patterns exactly', () => {
    const contractSource = readFileSync(
      path.join(process.cwd(), 'src/features/critical-care/test-support/teachingPanelContract.tsx'),
      'utf8',
    )
    const declaration =
      /const universalTargetPatterns: readonly RegExp\[\] = \[([\s\S]*?)\n\]/.exec(contractSource)
    expect(declaration).not.toBeNull()
    const contractPatterns = [
      ...(declaration?.[1] ?? '').matchAll(/^\s*(\/.*\/[a-z]*),\s*$/gm),
    ].map((match) => match[1])
    expect(contractPatterns.length).toBeGreaterThan(0)
    expect(ecmoUniversalTargetPatterns.map((pattern) => String(pattern))).toEqual(contractPatterns)
  })

  it('registers every source it names, and names the sources for both axes and the console', () => {
    expect(ECMO_CONTROL_PANEL.sourceIds.length).toBeGreaterThan(0)
    for (const id of ECMO_CONTROL_PANEL.sourceIds) expect(evidenceById.has(id)).toBe(true)
    // Blood-flow titration, sweep titration, the console's own controls, and the bounded model
    // that answers for how this simulation responds to any of them.
    expect([...ECMO_CONTROL_PANEL.sourceIds]).toEqual([
      'ecmo-book-ch17',
      'ecmo-book-ch18',
      'ifu-console-workflow',
      'bounded-educational-model',
    ])
  })
})

describe('the panel validator catches what it claims to', () => {
  it('rejects a fourth knob', () => {
    const errors = validateEcmoControlPanel({
      ...ECMO_CONTROL_PANEL,
      knobs: [
        ...ECMO_CONTROL_PANEL.knobs,
        {
          id: 'pump-speed',
          plainName: 'Flow target',
          consoleLabel: 'L/min',
          axis: 'blood path',
          principallyMoves: 'the flow the console holds',
          doesNotMove: 'anything on the gas path',
        },
      ],
    }).join('\n')
    expect(errors).toContain('exactly three knobs')
  })

  it('rejects a number in a knob record', () => {
    const errors = validateEcmoControlPanel({
      ...ECMO_CONTROL_PANEL,
      knobs: ECMO_CONTROL_PANEL.knobs.map((knob) =>
        knob.id === 'sweep' ? { ...knob, principallyMoves: 'CO₂ clearance, aim for 4' } : knob,
      ),
    }).join('\n')
    expect(errors).toContain('sweep.principallyMoves')
    expect(errors).toContain('a number appears in learner-facing copy')
  })

  it('rejects a knob the panel sentence does not name', () => {
    const errors = validateEcmoControlPanel({
      ...ECMO_CONTROL_PANEL,
      knobs: ECMO_CONTROL_PANEL.knobs.map((knob) =>
        knob.id === 'sweep' ? { ...knob, plainName: 'Gas flow' } : knob,
      ),
    }).join('\n')
    expect(errors).toContain('the panel sentence does not name it')
  })

  it('rejects a source that is not registered', () => {
    const errors = validateEcmoControlPanel({
      ...ECMO_CONTROL_PANEL,
      sourceIds: ['ecmo-book-ch17', 'ecmo-book-ch99'],
    }).join('\n')
    expect(errors).toContain('names a source that is not registered')
  })

  it('rejects copy phrased as a universal target', () => {
    expect(
      ecmoLearnerCopyErrors('example', 'Keep the sweep above 4 L/min on every circuit.').join('\n'),
    ).toMatch(/universal target/)
  })

  it('rejects a reviewed learner-copy term, and accepts one an override names', () => {
    expect(ecmoLearnerCopyErrors('example', 'Your score for this round.').join('\n')).toContain(
      'reviewed terms: score',
    )
    expect(
      ecmoLearnerCopyErrors('example', 'Your score for this round.', {
        learnerCopyOverrideReason: 'uses score in its clinical sense',
      }),
    ).toEqual([])
  })
})
