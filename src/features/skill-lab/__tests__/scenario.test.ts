import { advanceScenario, initScenario, timeoutScenario } from '../engine/scenario'
import type { DecisionScenario } from '../engine/types'

/**
 * A small three-node scenario used to exercise the pure state machine:
 *   start ──safe──▶ rescued (terminal)
 *         └─unsafe─▶ deteriorate ──▶ harm (terminal)
 */
const scenario: DecisionScenario = {
  id: 'test-scenario',
  title: 'Test scenario',
  briefing: 'A simulated intraprocedural decision.',
  initialVitals: { spo2: 96, hr: 90, sbp: 120 },
  startNodeId: 'start',
  nodes: [
    {
      id: 'start',
      situation: 'Recognize the problem and act.',
      decisionSeconds: 15,
      choices: [
        {
          id: 'act-correctly',
          label: 'Take the safe action',
          feedback: 'Correct recognition and response.',
          isSafe: true,
          nextNodeId: 'rescued',
        },
        {
          id: 'delay',
          label: 'Delay and observe',
          feedback: 'Delay lets the situation worsen.',
          isSafe: false,
          vitalsDelta: { spo2: -8, hr: 20, sbp: -15 },
          nextNodeId: 'deteriorate',
        },
      ],
    },
    {
      id: 'deteriorate',
      situation: 'The patient is now deteriorating.',
      choices: [
        {
          id: 'rescue-late',
          label: 'Escalate now',
          feedback: 'Late escalation; some harm already done.',
          isSafe: true,
          nextNodeId: 'harm',
        },
      ],
    },
    {
      id: 'rescued',
      situation: 'Stabilized.',
      choices: [],
      terminal: {
        outcome: 'rescued',
        debrief: 'Prompt recognition prevented harm.',
        referenceIds: ['ref-1'],
      },
    },
    {
      id: 'harm',
      situation: 'Preventable deterioration occurred.',
      choices: [],
      terminal: {
        outcome: 'harm',
        debrief: 'Delay allowed avoidable physiologic harm.',
        referenceIds: ['ref-1'],
      },
    },
  ],
}

describe('initScenario', () => {
  it('starts at the start node with clamped initial vitals and empty history', () => {
    const state = initScenario(scenario)
    expect(state.nodeId).toBe('start')
    expect(state.vitals).toEqual({ spo2: 96, hr: 90, sbp: 120 })
    expect(state.history).toEqual([])
    expect(state.finished).toBe(false)
  })
})

describe('advanceScenario', () => {
  it('follows a safe choice straight to a terminal and finishes', () => {
    const start = initScenario(scenario)
    const next = advanceScenario(scenario, start, 'act-correctly')
    expect(next.nodeId).toBe('rescued')
    expect(next.finished).toBe(true)
    expect(next.history).toEqual(['act-correctly'])
    // No vitalsDelta on the safe choice — vitals unchanged.
    expect(next.vitals).toEqual({ spo2: 96, hr: 90, sbp: 120 })
  })

  it('applies vitalsDelta and records history on an unsafe choice', () => {
    const start = initScenario(scenario)
    const next = advanceScenario(scenario, start, 'delay')
    expect(next.nodeId).toBe('deteriorate')
    expect(next.finished).toBe(false)
    expect(next.vitals).toEqual({ spo2: 88, hr: 110, sbp: 105 })
    expect(next.history).toEqual(['delay'])
  })

  it('is a no-op on an unknown choice id', () => {
    const start = initScenario(scenario)
    const next = advanceScenario(scenario, start, 'does-not-exist')
    expect(next).toBe(start)
  })

  it('is a no-op once finished', () => {
    const start = initScenario(scenario)
    const done = advanceScenario(scenario, start, 'act-correctly')
    const again = advanceScenario(scenario, done, 'act-correctly')
    expect(again).toBe(done)
  })

  it('clamps spo2 at 100 and never below 0', () => {
    const spiky: DecisionScenario = {
      ...scenario,
      initialVitals: { spo2: 98, hr: 90, sbp: 120 },
      nodes: scenario.nodes.map((node) =>
        node.id === 'start'
          ? {
              ...node,
              choices: [
                {
                  id: 'overshoot',
                  label: 'x',
                  feedback: 'x',
                  isSafe: true,
                  vitalsDelta: { spo2: 20 },
                  nextNodeId: 'rescued',
                },
              ],
            }
          : node,
      ),
    }
    const state = advanceScenario(spiky, initScenario(spiky), 'overshoot')
    expect(state.vitals.spo2).toBe(100)
  })
})

describe('timeoutScenario', () => {
  it('takes the safe branch when the timer expires', () => {
    const start = initScenario(scenario)
    const next = timeoutScenario(scenario, start)
    // 'act-correctly' is safe (severity 0); 'delay' is unsafe — safe wins.
    expect(next.history).toEqual(['act-correctly'])
    expect(next.nodeId).toBe('rescued')
  })

  it('is a no-op once finished', () => {
    const start = initScenario(scenario)
    const done = advanceScenario(scenario, start, 'act-correctly')
    expect(timeoutScenario(scenario, done)).toBe(done)
  })

  it('picks the least-severe choice when no choice is fully safe', () => {
    const allUnsafe: DecisionScenario = {
      ...scenario,
      nodes: scenario.nodes.map((node) =>
        node.id === 'start'
          ? {
              ...node,
              choices: [
                {
                  id: 'big-hit',
                  label: 'big',
                  feedback: 'big',
                  isSafe: false,
                  vitalsDelta: { spo2: -20 },
                  nextNodeId: 'harm',
                },
                {
                  id: 'small-hit',
                  label: 'small',
                  feedback: 'small',
                  isSafe: false,
                  vitalsDelta: { spo2: -3 },
                  nextNodeId: 'deteriorate',
                },
              ],
            }
          : node,
      ),
    }
    const next = timeoutScenario(allUnsafe, initScenario(allUnsafe))
    expect(next.history).toEqual(['small-hit'])
  })
})
