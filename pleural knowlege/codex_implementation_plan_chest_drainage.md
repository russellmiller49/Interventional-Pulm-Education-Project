# Codex Implementation Plan: Interactive Chest Drainage System Educational Module

## Goal

Create a feature-isolated website module that teaches chest drainage physiology, system design, knobology, and troubleshooting through interactive simulations. The module is educational and must not be framed as patient-specific medical advice.

## Default stack

Use the existing site stack if present. If starting fresh, use:

- Next.js App Router
- React + TypeScript
- SVG for device diagrams and water/bubble animation
- Zustand or React Context for simulation state
- Vitest for engine unit tests
- Playwright for E2E tests
- axe-core for accessibility checks
- MDX or typed content files for lessons and references

## Feature structure

```text
src/features/chest-drainage/
  content/
    lessons.ts
    references.ts
    glossary.ts
    quizItems.ts
  engine/
    types.ts
    constants.ts
    pleuralPhysics.ts
    scenarioEngine.ts
    alarms.ts
  components/
    SystemDiagram.tsx
    BottleSystemLab.tsx
    AnalogCDULab.tsx
    DigitalDrainCockpit.tsx
    TroubleshootingCase.tsx
    PressureTrendChart.tsx
    KnobPanel.tsx
    DebriefPanel.tsx
  scenarios/
    pneumothorax.ts
    pleuralEffusion.ts
    postOpAirLeak.ts
    hemothorax.ts
    pleuralInfection.ts
  __tests__/
    pleuralPhysics.test.ts
    scenarioEngine.test.ts
app/education/chest-drainage/
  page.tsx
  learn/page.tsx
  simulators/page.tsx
  troubleshooting/page.tsx
  assessment/page.tsx
  references/page.tsx
```

## Simulation state model

```ts
export type DrainageSystemType =
  | 'oneBottleWaterSeal'
  | 'twoBottleWaterSeal'
  | 'threeBottleWetSuction'
  | 'integratedWetSuction'
  | 'integratedDrySuction'
  | 'drySealDrySuction'
  | 'digitalDrainage'
  | 'heimlichValve'

export interface SimulationState {
  systemType: DrainageSystemType
  patient: {
    ventilation: 'spontaneous' | 'positivePressure'
    lungCompliance: number
    pleuralPressureCmH2O: number
    airLeakSeverity: number
    fluidProductionMlPerHr: number
    cough: boolean
  }
  tube: {
    frenchSize: number
    patency: number
    kinked: boolean
    clamped: boolean
    dependentLoop: boolean
    sideHolesInChest: boolean
  }
  device: {
    waterSealDepthCm: number
    suctionSettingCmH2O: number
    sourceSuctionFlowLpm: number
    collectionVolumeMl: number
    upright: boolean
    heightBelowChestCm: number
    canisterFull: boolean
    batteryPct?: number
  }
}
```

## Teaching equations

Keep them intentionally simple and transparent.

```ts
tubeConductance = (k * radius) ^ ((4 * patency) / viscosityFactor)
effectiveSuctionWet = min(abs(suctionControlDepthCm), sourceCapacity)
effectiveSuctionDry = approach(targetSuction, responseLag, capacityLimit)
expiratoryAirExit = max(pleuralPressure - waterSealDepth, 0) * tubeConductance
digitalFlowDisplay = smooth(trueAirLeakFlow + coughSpikes + measurementNoise)
riskReexpansionEdema = chronicCollapse * rapidExpansion * highNegativePressure
```

## MVP modules

1. **Pressure primer**: pleural pressure, respiratory cycle, spontaneous vs positive-pressure ventilation.
2. **Bottle system lab**: one-, two-, and three-bottle systems. Learner fills water seal and adds suction.
3. **Analog CDU lab**: integrated collection chamber, water seal, air leak meter, wet vs dry suction, relief valves.
4. **Digital cockpit**: target pressure, mL/min air leak trend, fluid trend, alarms, canister and battery states.
5. **Troubleshooting rounds**: eight branching cases.
6. **Assessment**: mixed quiz plus scenario decisions.
7. **References and disclaimer**: clinical references, manufacturer IFU note, local-policy note.

## Troubleshooting cases

- Continuous bubbling: patient leak vs system leak.
- No tidaling: occlusion, kink, dependent loop, lung re-expansion, or malposition.
- Knocked-over system: water seal integrity and device replacement.
- High negative pressure: cough, respiratory distress, stripping, or suction changes.
- Dry suction indicator absent: source suction or regulator issue.
- Digital blocked-tube alarm: tube/canister/tubing workflow.
- Subcutaneous emphysema: tube position, patency, leak evacuation vs leak generation.
- Re-expansion risk: large chronic pneumothorax/effusion and abrupt high suction.

## Codex prompt sequence

### Prompt 1: Repo reconnaissance

Inspect this repository and identify the frontend framework, routing approach, styling system, test setup, and deployment constraints. Do not modify files. Return a concise implementation plan for adding a feature-isolated chest-drainage education module.

### Prompt 2: Route scaffold

Create a feature branch and add a new route `/education/chest-drainage` with placeholder subpages: learn, simulators, troubleshooting, assessment, and references. Add navigation cards and ensure the route matches existing site styling. Do not add clinical content yet.

### Prompt 3: Content data model

Add feature-local TypeScript content files for lessons, glossary, references, and quiz items. Populate with neutral placeholder data and types. Keep all clinical text in data files, not component logic.

### Prompt 4: Simulation engine

Implement `SimulationState`, constants, and pure functions in `engine/pleuralPhysics.ts`. Include unit tests verifying: water seal prevents return flow, increasing water seal depth increases resistance, tube clamping stops flow, and dry suction target is bounded by source capacity.

### Prompt 5: Bottle simulator

Build an SVG `BottleSystemLab` where learners assemble one-, two-, and three-bottle systems, fill water seal, add suction, and see arrows/bubbles/water levels update from state.

### Prompt 6: Analog CDU lab

Build a generic integrated chest drainage unit simulator with collection chamber, water seal, air leak meter, wet/dry suction mode, suction indicator, high-negativity relief, and a control panel. Include warnings for unsafe clamping and compromised water seal.

### Prompt 7: Digital cockpit

Build `DigitalDrainCockpit` with target pressure, air leak mL/min trend, fluid output trend, canister/battery/tubing alarms, and a debrief panel explaining trend-based decisions.

### Prompt 8: Troubleshooting cases

Implement `scenarioEngine.ts` and at least eight branching cases: continuous bubbling, no tidaling, high output, high negativity, subcutaneous emphysema, digital blocked-tube alarm, knocked-over system, and re-expansion risk. Each case must include patient-first assessment and debrief.

### Prompt 9: Assessment and accessibility

Add quiz and scenario scoring, keyboard control for all knobs, `aria` labels for dynamic indicators, prefers-reduced-motion handling, and axe-core checks. Add Playwright smoke tests for the main route and one simulator interaction.

### Prompt 10: Clinical review mode

Add a reviewer page or export that lists all clinical statements, thresholds, references, and last-reviewed dates so medical reviewers can approve content without searching the component tree.

## Clinical governance

- Do not imply patient-specific clinical advice.
- Store all clinical statements in reviewable data files with reviewer/date metadata.
- Use peer-reviewed/guideline sources for clinical claims.
- Use manufacturer IFUs for device-specific setup.
- Do not collect PHI.
- Avoid copying proprietary product screens or exact manufacturer artwork unless licensed.
- Review annually and after major guideline or IFU updates.

## Accessibility

Target WCAG 2.2 AA. Every animation must have text output; every slider/knob must work by keyboard; all visual states must also be stated in text; users must be able to pause or step through animations.
