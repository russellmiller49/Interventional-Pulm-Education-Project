/**
 * The live pressure profile makes no new clinical or device-display claim.
 *
 * Every statement it puts beside a value is the circuit model's own registered
 * teaching for that signal, and everything else it says is an explicit
 * statement about the educational model itself or about where the boundary of
 * this module lies. These tests hold that arrangement, because the cheap way to
 * break it is to write a plausible sentence about what a commercial console
 * does and hang a resolving-but-unrelated source id on it.
 */
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CrrtLivePressureDevice } from '../components/CrrtLivePressureDevice'
import {
  crrtCircuitNodeIds,
  crrtCitrateSourceGapTermIds,
  crrtPressureSignalDetails,
} from '../content/circuitModel'
import {
  CRRT_CLAIM_TOPICS,
  crrtSourcesSupportingClaim,
  crrtSourceSupportsClaim,
  isResolvableCrrtSourceId,
} from '../content/learnerSourceMap'
import {
  createInitialPrismaxPilotInterfaceState,
  selectPrismaxPilotCaseOperationsDisplay,
} from '../engine/deviceAdapters/prismax'
import { runningState } from '../engine/testSupport/livePressureStates'
import { prismaxSimulatorHotspots, prismaxStaticReferenceNotice } from '../content/prismaxSimulator'

const componentDirectory = join(process.cwd(), 'src/features/baxter-crrt/components')

function profileText(): string {
  const view = render(
    <CrrtLivePressureDevice
      operations={selectPrismaxPilotCaseOperationsDisplay(
        createInitialPrismaxPilotInterfaceState(),
        runningState(),
      )}
      selectedSignalId="tmp"
      onSelectSignal={() => {}}
    />,
  )
  const text = view.container.textContent ?? ''
  view.unmount()
  return text
}

/** Every evidence-record id shape this module uses. */
const EVIDENCE_ID_PATTERN =
  /\b(?:DEV|MATH|FLUID|DOSE|SYNTH|REVIEW|TEXT|GUID|CONFLICT)-[A-Z0-9-]+\b/g

describe('live pressure profile — provenance', () => {
  it('shows no evidence-record id as learner copy', () => {
    expect(profileText().match(EVIDENCE_ID_PATTERN)).toBeNull()
  })

  it('shows no evidence-record id on the static reference either', () => {
    const text = [
      ...prismaxSimulatorHotspots.map((hotspot) => hotspot.description),
      prismaxStaticReferenceNotice.summary,
      prismaxStaticReferenceNotice.unsynchronisedNotice,
      prismaxStaticReferenceNotice.fidelityBoundary,
    ].join(' ')
    expect(text.match(EVIDENCE_ID_PATTERN)).toBeNull()
  })

  it('carries every per-signal citation through unchanged, inventing none', () => {
    const operations = selectPrismaxPilotCaseOperationsDisplay(
      createInitialPrismaxPilotInterfaceState(),
      runningState(),
    )
    for (const signal of operations.pressureSignals) {
      const detail = crrtPressureSignalDetails.find((candidate) => candidate.id === signal.id)!
      expect(signal.sourceIds).toEqual(detail.sourceIds)
      for (const id of signal.sourceIds) {
        expect([id, isResolvableCrrtSourceId(id)]).toEqual([id, true])
      }
    }
  })

  /**
   * The rule the module already learned once: an id that resolves is not an id
   * that supports. Every device-pressure record resolves and supports nothing,
   * which is why none of them is attached as support anywhere.
   */
  it('lets no device-pressure record support a topic merely because it resolves', () => {
    for (const id of [
      'DEV-PM-009',
      'DEV-PM-010',
      'DEV-PM-003',
      'DEV-PM-014',
      'MATH-PM-002',
      'SYNTH-LAB-PRESSURE-001',
    ]) {
      expect([id, isResolvableCrrtSourceId(id)]).toEqual([id, true])
      for (const topic of CRRT_CLAIM_TOPICS) {
        expect([id, topic, crrtSourceSupportsClaim(id, topic)]).toEqual([id, topic, false])
      }
    }
  })

  it('adds no claim topic keyed to a device record', () => {
    for (const topic of CRRT_CLAIM_TOPICS) {
      for (const id of crrtSourcesSupportingClaim(topic)) {
        expect([topic, id, /^DEV-PM-/.test(id)]).toEqual([topic, id, false])
      }
    }
  })

  it('leaves the citrate source gaps exactly as they were', () => {
    expect(crrtSourcesSupportingClaim('citrate-pharmacology')).toEqual([])
    expect(crrtCitrateSourceGapTermIds()).toEqual([
      'circuit-anticoagulation',
      'citrate-calcium-in-effluent',
    ])
  })

  /**
   * Statements about where a value is read are read off the authored circuit,
   * so they name a frozen node rather than citing a clinical record.
   */
  it('grounds every location statement in a node of the authored circuit', () => {
    const operations = selectPrismaxPilotCaseOperationsDisplay(
      createInitialPrismaxPilotInterfaceState(),
      runningState(),
    )
    for (const signal of operations.pressureSignals) {
      if (signal.kind === 'directly-modelled-site') {
        expect(crrtCircuitNodeIds).toContain(signal.nodeId)
        expect(signal.derivedFromNodeIds).toEqual([])
      } else {
        expect(signal.nodeId).toBeNull()
        expect(signal.derivedFromNodeIds.length).toBeGreaterThan(0)
        for (const nodeId of signal.derivedFromNodeIds) {
          expect(crrtCircuitNodeIds).toContain(nodeId)
        }
      }
    }
  })

  /**
   * Anything the surface says about a commercial console has to be a boundary
   * statement, not an assertion of behaviour. This is the sentence that keeps
   * exact-fidelity work out of this package.
   */
  it('labels device behaviour as out of scope rather than describing it', () => {
    const text = profileText()
    expect(text).toMatch(
      /Exactly how a commercial machine displays, groups, or alarms on these values belongs to the manufacturer(?:’|')s instructions and your local training, not to this model/i,
    )
    expect(text).toMatch(
      /These are modelled device values, not readings from a machine at a bedside/i,
    )
    expect(text).not.toMatch(/the console (?:shows|displays|groups)/i)
    expect(text).not.toMatch(/PrisMax/)
  })

  it('never presents an educational number as a device specification', () => {
    const source = readFileSync(join(componentDirectory, 'CrrtLivePressureDevice.tsx'), 'utf8')
    // No literal pressure value is authored into the surface at all.
    expect(source).not.toMatch(/\d+\s*mmHg/)
  })
})
