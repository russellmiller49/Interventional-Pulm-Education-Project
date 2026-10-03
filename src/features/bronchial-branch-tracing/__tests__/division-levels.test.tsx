/**
 * PR #273 independent review, finding 1 (P2, introduced by Prompt 04): the "Levels at this
 * division" primer called Lesson 5's response slice 307 the node's level, although the model node
 * lies nearest native slice 306. The expected levels here are derived from the raw export and the
 * native-v1 IJK→LPS matrix, not from the display helper.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { BranchTracingLesson } from '../components/BranchTracingLesson'
import { courseFor, courseSentences } from '../components/DivisionPrimer'
import { LESSONS } from '../content/lessons'
import { localExercise } from '../content/local-exercises'
import { divisionIdentities } from '../engine/branch-identity'
import decisions from '../geometry/branch-decisions.json'
import nativeManifest from '../../../../public/branch-tracing/native-v1/manifest.json'

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
beforeEach(() => {
  window.localStorage.clear()
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
const ready = () => document.querySelectorAll('image').forEach((image) => fireEvent.load(image))
const click = (name: string | RegExp) => {
  ready()
  fireEvent.click(screen.getByRole('button', { name }))
  ready()
}

/** Native slice index of a patient z, from the manifest's own IJK→LPS matrix. */
const [, , [, , zSpacing, zOrigin]] = nativeManifest.ijkToLps
const nearestSlice = (z: number) => Math.round((z - zOrigin) / zSpacing)
function rawDecision(traceId: string, checkpointId: string) {
  const trace = decisions.traces.find((t) => t.id === traceId)!
  return trace.checkpoints.find((c) => c.id === checkpointId)!.decision!
}
const slices = (n: number) => `${n} ${n === 1 ? 'slice' : 'slices'}`
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('Lesson 5 source levels are stated as the source has them', () => {
  const lesson = LESSONS.find((l) => l.id === 'horizontal-horizontal')!
  const spec = lesson.exercises![1]
  const raw = rawDecision(spec.traceId, spec.checkpointId)

  it('pins the unchanged source: model node nearest native slice 306, parent and responses on 307', () => {
    expect(spec).toMatchObject({ traceId: 'middle-lobe-lateral', checkpointId: 'junction-19' })
    expect((raw.junctionLps[2] - zOrigin) / zSpacing).toBeCloseTo(306.121, 3)
    expect(nearestSlice(raw.junctionLps[2])).toBe(306)
    expect(raw.parent.slice).toBe(307)
    expect(raw.options.map((o) => o.slice)).toEqual([307, 307])
  })

  it('says the response slice lies one slice cranial of the model node, never on its level', async () => {
    render(<BranchTracingLesson requestedId={lesson.id} />)
    await screen.findByRole('button', { name: 'Start marking branches' })
    click('Start marking branches')
    click('Continue without marking')
    if (screen.queryByRole('button', { name: 'Compare with the caudal tracing view' })) {
      click('Compare with the caudal tracing view')
      click('Apply this to the same airway')
    }
    click(/^Next example: RB4/)
    const primer = document.querySelector(
      `[data-division-primer="${spec.checkpointId}"]`,
    ) as HTMLElement
    const text = primer.textContent!
    expect(text).not.toMatch(/response slice, 307, lies on the node’s level/)
    expect(text).toContain('The model node lies nearest native slice 306.')
    expect(text).toContain('The parent point (RB4) is on slice 307, 1 slice cranial of the node')
    const identities = divisionIdentities(localExercise(spec).trace.checkpoints[0])!
    for (const d of identities.daughters)
      expect(text).toContain(
        `${d.display}’s response slice, 307, lies 1 slice cranial of the model node`,
      )
  })
})

describe('every generated level sentence matches the raw source offsets', () => {
  for (const lesson of LESSONS)
    for (const spec of lesson.exercises ?? []) {
      const ex = localExercise(spec)
      const course = courseFor(ex)
      if (!course) continue
      it(`${lesson.id} · ${spec.checkpointId}`, () => {
        const raw = rawDecision(spec.traceId, spec.checkpointId)
        const node = nearestSlice(raw.junctionLps[2])
        const text = courseSentences(course, lesson.id).join(' ')
        expect(text).toContain(`The model node lies nearest native slice ${node}.`)
        const identities = divisionIdentities(ex.trace.checkpoints[0])!
        raw.options.forEach((option, i) => {
          const offset = option.slice - node
          const expected =
            offset === 0
              ? `${identities.daughters[i].display}’s response slice, ${option.slice}, is the native slice nearest the model node`
              : `${identities.daughters[i].display}’s response slice, ${option.slice}, lies ${slices(Math.abs(offset))} ${offset > 0 ? 'cranial' : 'caudal'} of the model node`
          expect(text).toMatch(new RegExp(escape(expected)))
        })
        expect(text).not.toMatch(/on the node’s level/)
        // The Lesson 8 example sentence ("descend and then turn cranially") only where the parent
        // is followed caudally.
        if (/descend and then turn cranially/.test(text))
          expect(raw.parent.slice).toBeGreaterThan(node + 1)
      })
    }
})
