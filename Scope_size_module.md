1. Main Codex implementation prompt
   Build a new interactive educational module for interventionalpulm.com titled:

Bronchoscope Size, Reach & Tool Fit Explorer

## Goal

Create a React/TypeScript educational module that helps learners compare therapeutic bronchoscopes, diagnostic/thin bronchoscopes, ultrathin bronchoscopes, and robotic bronchoscopy catheters by:

- Outer diameter
- Working channel diameter
- Estimated airway reach by generation
- Instrument compatibility
- Remaining working channel area
- Practical tradeoffs between reach and therapeutic/tool capability

This is an educational visualization, not a procedural recommendation tool.

## First inspect the repository

Before coding:

1. Inspect package.json.
2. Identify whether the app uses Next.js app router, pages router, MDX, Vite, or another structure.
3. Identify styling conventions.
4. Identify where existing educational modules/tools live.
5. Place this module in the most appropriate existing location.
6. Reuse existing UI primitives if present.

Do not introduce unnecessary dependencies.

## Build the module

Create a module with these main UI sections:

### 1. Header

Title:

Bronchoscope Size, Reach & Tool Fit Explorer

Subtitle:

Compare scope diameter, working channel size, estimated airway reach, and instrument compatibility.

Include an educational disclaimer:

This module is for education and device-size comparison only. Actual airway reach and instrument compatibility depend on patient anatomy, airway caliber, device model, accessory compatibility, manufacturer instructions, procedural conditions, and operator judgment.

### 2. Scope selector

Provide selectable cards or buttons for at least these presets:

1. Therapeutic bronchoscope
   - Example dimensions: 6.2 mm outer diameter, 2.8 mm working channel
   - Category: therapeutic

2. Thin diagnostic bronchoscope
   - Example dimensions: 4.2 mm outer diameter, 2.0 mm working channel
   - Category: thin/diagnostic

3. Ultrathin bronchoscope
   - Example dimensions: 3.0 mm outer diameter, 1.7 mm working channel
   - Category: ultrathin

4. Ultraslim single-use bronchoscope
   - Example dimensions: 2.7 mm outer diameter, 1.2 mm working channel
   - Category: ultrathin/single-use

5. Slim single-use bronchoscope
   - Example dimensions: 4.2 mm outer diameter, 2.2 mm working channel
   - Category: thin/single-use

6. Therapeutic single-use bronchoscope
   - Example dimensions: 5.6 mm outer diameter, 2.8 mm working channel
   - Category: therapeutic/single-use

7. Robotic catheter example
   - Example dimensions: 3.5 mm outer diameter, 2.0 mm working channel
   - Category: robotic catheter

8. Robotic bronchoscope/sheath example
   - Example dimensions: 4.2 mm inner bronchoscope, 2.1 mm working channel
   - Optional sheath diameter: 6.0 mm
   - Category: robotic bronchoscope

9. Compact robotic bronchoscope example
   - Example dimensions: 4.0 mm outer diameter, 2.1 mm working channel
   - Category: robotic bronchoscope

Make the data editable in a separate data file. Do not hardcode it inside components.

Each entry should include:

- id
- displayName
- shortName
- category
- outerDiameterMm
- workingChannelMm
- optional sheathDiameterMm
- notes
- sourceLabel
- sourceUrl

### 3. Instrument selector

Provide selectable instrument/accessory presets:

1. Radial EBUS probe
   - minimumWorkingChannelMm: 1.7

2. Flexible TBNA needle
   - minimumWorkingChannelMm: 1.7

3. Small biopsy forceps
   - minimumWorkingChannelMm: 1.7

4. Cytology brush
   - minimumWorkingChannelMm: 1.7

5. 2.0 mm guide sheath system
   - minimumWorkingChannelMm: 2.0

6. 2.6 mm guide sheath system
   - minimumWorkingChannelMm: 2.6

7. 1.1 mm cryoprobe with oversheath
   - minimumWorkingChannelMm: 2.8
   - note: Through-working-channel workflows may require specific oversheath/device combinations.

8. 1.7 mm cryoprobe
   - outerDiameterMm: 1.7
   - note: Extraction workflow is device- and technique-dependent.

9. 2.4 mm cryoprobe
   - outerDiameterMm: 2.4
   - note: Often requires larger working channel or scope removal workflow depending on device and technique.

10. Custom instrument

- Allow user to enter custom outer diameter and/or required working channel.

Make the data editable in a separate data file. Do not hardcode it inside components.

### 4. Cross-section visualization

Build an SVG visualization that shows:

- Airway lumen as a background ring or circle.
- Selected scope outer diameter as a circle.
- Working channel as an inner circle.
- Selected instrument as a smaller circle inside the working channel when instrument diameter is known.
- If the instrument uses minimumWorkingChannelMm but not outerDiameterMm, show a placeholder marker and text result.

The circles should be proportionally scaled by diameter.

Show numeric labels:

- Scope OD
- Working channel diameter
- Working channel area in mm²
- Remaining channel area in mm², when instrument diameter is known

Formula:

area = π × (diameter / 2)^2

### 5. Airway reach map

Create a simple educational airway generation display.

Use a data file with generation, approximate airway diameter, and label.

For MVP, include generations 0 through 8.

Use an approximate adult educational model such as:

generation 0: 18.0 mm
generation 1: 12.0 mm
generation 2: 9.0 mm
generation 3: 7.0 mm
generation 4: 5.5 mm
generation 5: 4.5 mm
generation 6: 3.5 mm
generation 7: 2.8 mm
generation 8: 2.2 mm

Important: Label this as an approximate educational model, not a patient-specific airway model.

Use this formula:

scope can pass generation if:
airwayDiameterMm >= scopeOuterDiameterMm + clearanceMm

Default clearanceMm: 0.3

Show:

- Reachable generations
- Borderline generations
- Unreachable generations

For robotic platforms, add a note:

Robotic platform reach is influenced by diameter, articulation, stability, navigation, and confirmation imaging; this visualization models size only.

### 6. Compatibility result panel

When a user selects a scope and instrument, display:

- Fits
- Borderline
- Does not fit
- Unknown

Compatibility rules:

If instrument.minimumWorkingChannelMm exists:

- fits if scope.workingChannelMm >= minimumWorkingChannelMm
- borderline if difference is between 0 and 0.2 mm
- does-not-fit if scope.workingChannelMm < minimumWorkingChannelMm

If instrument.outerDiameterMm exists:

- fits if scope.workingChannelMm >= instrument.outerDiameterMm + 0.1
- borderline if scope.workingChannelMm >= instrument.outerDiameterMm but less than instrument.outerDiameterMm + 0.1
- does-not-fit if scope.workingChannelMm < instrument.outerDiameterMm

Also show:

- Channel area
- Instrument area, if known
- Remaining channel area, if known
- A caution if remaining channel area is small

Suggested caution threshold:
remainingChannelArea / channelArea < 0.25

Text:

Instrument may technically fit, but little channel area remains for suction or fluid clearance.

### 7. Comparison table

Add a responsive table comparing all scope presets:

Columns:

- Scope/platform
- Category
- OD
- Working channel
- Channel area
- Estimated reach label
- Notes

### 8. Source notes

Add a source/evidence notes section.

Each scope and instrument should have sourceLabel and sourceUrl fields.

Render links safely.

Use neutral language. Do not present source dimensions as exhaustive of all models.

## Types

Create TypeScript types similar to:

````ts
export type ScopeCategory =
  | "therapeutic"
  | "diagnostic"
  | "thin"
  | "ultrathin"
  | "single-use"
  | "robotic-catheter"
  | "robotic-bronchoscope";

export type BronchoscopeDevice = {
  id: string;
  displayName: string;
  shortName: string;
  category: ScopeCategory;
  outerDiameterMm: number;
  workingChannelMm: number;
  sheathDiameterMm?: number;
  notes: string[];
  sourceLabel?: string;
  sourceUrl?: string;
};

export type InstrumentCategory =
  | "radial-ebus"
  | "needle"
  | "forceps"
  | "brush"
  | "guide-sheath"
  | "cryoprobe"
  | "custom";

export type BronchoscopyInstrument = {
  id: string;
  displayName: string;
  category: InstrumentCategory;
  outerDiameterMm?: number;
  minimumWorkingChannelMm?: number;
  notes: string[];
  sourceLabel?: string;
  sourceUrl?: string;
};

export type AirwayGeneration = {
  generation: number;
  label: string;
  approximateDiameterMm: number;
};
Utility functions
Create a utility file with pure functions:
export function circleAreaMm2(diameterMm: number): number;

export function getRemainingChannelAreaMm2(
  channelDiameterMm: number,
  instrumentDiameterMm?: number
): number | null;

export function classifyInstrumentFit(
  workingChannelMm: number,
  instrument: BronchoscopyInstrument,
  clearanceMm?: number
): "fits" | "borderline" | "does-not-fit" | "unknown";

export function getReachableGenerations(
  scopeOuterDiameterMm: number,
  airwayGenerations: AirwayGeneration[],
  clearanceMm?: number
): {
  generation: number;
  status: "reachable" | "borderline" | "unreachable";
}[];

export function getEstimatedReachLabel(
  maxReachableGeneration: number
): string;
Styling and UX
Use existing site styles if available.
Otherwise, create a clean responsive layout:
Desktop:
•	Left: scope selector
•	Center: cross-section visual
•	Right: instrument compatibility and reach map
Mobile:
•	Stack sections vertically
Design should feel like an educational interactive lab, not a product comparison advertisement.
Accessibility
Implement:
•	Semantic buttons
•	Visible focus states
•	ARIA labels on SVG where appropriate
•	Text result equivalent for every visual result
•	Keyboard-accessible interaction
Testing
If the repo has a test framework, add tests for:
•	circleAreaMm2
•	remaining channel area
•	classifyInstrumentFit
•	getReachableGenerations
•	getEstimatedReachLabel
Run:
•	lint
•	typecheck
•	tests
•	build
Use the package manager already used by the repo.
Completion summary
At the end, provide:
1.	Files created or modified.
2.	How to access the new module.
3.	Test/build commands run and results.
4.	Any assumptions made.
5.	Any known limitations.

---

2. Seed data


```ts
import type {
  AirwayGeneration,
  BronchoscopeDevice,
  BronchoscopyInstrument,
} from "./types";

export const bronchoscopes: BronchoscopeDevice[] = [
  {
    id: "therapeutic-6-2-2-8",
    displayName: "Therapeutic bronchoscope",
    shortName: "Therapeutic",
    category: "therapeutic",
    outerDiameterMm: 6.2,
    workingChannelMm: 2.8,
    notes: [
      "Large working channel supports stronger suction and larger therapeutic tools.",
      "Less distal reach compared with thin or ultrathin bronchoscopes.",
    ],
    sourceLabel: "Representative therapeutic bronchoscope dimensions",
    sourceUrl: "https://medical.olympusamerica.com/products/bronchoscope/therapeutic-bronchoscope-bf-1th190",
  },
  {
    id: "thin-diagnostic-4-2-2-0",
    displayName: "Thin diagnostic bronchoscope",
    shortName: "Thin diagnostic",
    category: "thin",
    outerDiameterMm: 4.2,
    workingChannelMm: 2.0,
    notes: [
      "Balances distal access with a useful diagnostic working channel.",
    ],
    sourceLabel: "Representative thin diagnostic bronchoscope dimensions",
    sourceUrl: "https://medical.olympusamerica.com/products/diagnostic-bronchoscope-bf-p190",
  },
  {
    id: "ultrathin-3-0-1-7",
    displayName: "Ultrathin bronchoscope",
    shortName: "Ultrathin",
    category: "ultrathin",
    outerDiameterMm: 3.0,
    workingChannelMm: 1.7,
    notes: [
      "Improves peripheral access but reduces suction and tool options.",
    ],
    sourceLabel: "Representative ultrathin bronchoscope dimensions",
    sourceUrl: "https://medical.olympusamerica.com/products/bf-mp190f",
  },
  {
    id: "single-use-ultraslim-2-7-1-2",
    displayName: "Ultraslim single-use bronchoscope",
    shortName: "Single-use ultraslim",
    category: "single-use",
    outerDiameterMm: 2.7,
    workingChannelMm: 1.2,
    notes: [
      "Very small outer diameter with limited working channel capacity.",
    ],
    sourceLabel: "Representative single-use bronchoscope family dimensions",
    sourceUrl: "https://www.ambu.com/endoscopy/pulmonology/bronchoscopes/product/ascope-5-broncho",
  },
  {
    id: "single-use-slim-4-2-2-2",
    displayName: "Slim single-use bronchoscope",
    shortName: "Single-use slim",
    category: "single-use",
    outerDiameterMm: 4.2,
    workingChannelMm: 2.2,
    notes: [
      "Slim outer diameter with a larger channel than many ultrathin scopes.",
    ],
    sourceLabel: "Representative single-use bronchoscope family dimensions",
    sourceUrl: "https://www.ambu.com/endoscopy/pulmonology/bronchoscopes/product/ascope-5-broncho",
  },
  {
    id: "single-use-therapeutic-5-6-2-8",
    displayName: "Therapeutic single-use bronchoscope",
    shortName: "Single-use therapeutic",
    category: "single-use",
    outerDiameterMm: 5.6,
    workingChannelMm: 2.8,
    notes: [
      "Large channel for suction and therapeutic workflows, with less distal access than smaller scopes.",
    ],
    sourceLabel: "Representative single-use bronchoscope family dimensions",
    sourceUrl: "https://www.ambu.com/endoscopy/pulmonology/bronchoscopes/product/ascope-5-broncho",
  },
  {
    id: "robotic-catheter-3-5-2-0",
    displayName: "Robotic catheter example",
    shortName: "Robotic catheter",
    category: "robotic-catheter",
    outerDiameterMm: 3.5,
    workingChannelMm: 2.0,
    notes: [
      "Robotic reach depends on more than diameter, including articulation, stability, navigation, and imaging confirmation.",
    ],
    sourceLabel: "Representative robotic catheter dimensions",
    sourceUrl: "https://www.intuitive.com/en-us/products-and-services/ion/how-ion-works",
  },
  {
    id: "robotic-bronchoscope-sheath-4-2-2-1",
    displayName: "Robotic bronchoscope with outer sheath example",
    shortName: "Robotic scope/sheath",
    category: "robotic-bronchoscope",
    outerDiameterMm: 4.2,
    workingChannelMm: 2.1,
    sheathDiameterMm: 6.0,
    notes: [
      "Displays inner bronchoscope size and optional outer sheath size separately.",
      "Robotic platform performance is not determined by diameter alone.",
    ],
    sourceLabel: "Representative robotic bronchoscope/sheath dimensions",
    sourceUrl: "https://jtd.amegroups.org/article/view/89895/html",
  },
  {
    id: "compact-robotic-4-0-2-1",
    displayName: "Compact robotic bronchoscope example",
    shortName: "Compact robotic",
    category: "robotic-bronchoscope",
    outerDiameterMm: 4.0,
    workingChannelMm: 2.1,
    notes: [
      "Compact robotic bronchoscope example with small outer diameter and 2.1 mm working channel.",
    ],
    sourceLabel: "Representative compact robotic bronchoscope dimensions",
    sourceUrl: "https://jtd.amegroups.org/article/view/89895/html",
  },
];

export const instruments: BronchoscopyInstrument[] = [
  {
    id: "radial-ebus-probe",
    displayName: "Radial EBUS probe",
    category: "radial-ebus",
    minimumWorkingChannelMm: 1.7,
    notes: [
      "Compatibility varies by probe model and manufacturer instructions.",
    ],
    sourceLabel: "Representative radial EBUS working channel threshold",
    sourceUrl: "https://medical.olympusamerica.com/products/probes/radial-ebus-probes",
  },
  {
    id: "flexible-tbna-needle",
    displayName: "Flexible TBNA needle",
    category: "needle",
    minimumWorkingChannelMm: 1.7,
    notes: [
      "Peripheral TBNA needle compatibility varies by model.",
    ],
    sourceLabel: "Representative flexible TBNA working channel threshold",
    sourceUrl: "https://medical.olympusamerica.com/products/periview-flex-tbna-needle",
  },
  {
    id: "small-biopsy-forceps",
    displayName: "Small biopsy forceps",
    category: "forceps",
    minimumWorkingChannelMm: 1.7,
    notes: [
      "Use manufacturer instructions for exact compatibility.",
    ],
    sourceLabel: "Representative small forceps threshold",
    sourceUrl: "https://medical.olympusamerica.com/products/bf-mp190f",
  },
  {
    id: "cytology-brush",
    displayName: "Cytology brush",
    category: "brush",
    minimumWorkingChannelMm: 1.7,
    notes: [
      "Use manufacturer instructions for exact compatibility.",
    ],
    sourceLabel: "Representative cytology brush threshold",
    sourceUrl: "https://medical.olympusamerica.com/products/bf-mp190f",
  },
  {
    id: "guide-sheath-2-0",
    displayName: "2.0 mm guide sheath system",
    category: "guide-sheath",
    minimumWorkingChannelMm: 2.0,
    notes: [
      "Guide sheath compatibility depends on kit, scope, and procedural workflow.",
    ],
    sourceLabel: "Representative guide sheath channel size",
    sourceUrl: "https://www.olympusprofed.com/pulm/peripheral/1286/",
  },
  {
    id: "guide-sheath-2-6",
    displayName: "2.6 mm guide sheath system",
    category: "guide-sheath",
    minimumWorkingChannelMm: 2.6,
    notes: [
      "Larger guide sheath systems require larger working channels.",
    ],
    sourceLabel: "Representative guide sheath channel size",
    sourceUrl: "https://www.olympusprofed.com/pulm/peripheral/1286/",
  },
  {
    id: "cryoprobe-1-1-oversheath",
    displayName: "1.1 mm cryoprobe with oversheath",
    category: "cryoprobe",
    outerDiameterMm: 1.1,
    minimumWorkingChannelMm: 2.8,
    notes: [
      "Through-working-channel cryobiopsy workflows may require specific oversheath/device combinations.",
    ],
    sourceLabel: "Representative 1.1 mm cryoprobe workflow threshold",
    sourceUrl: "https://us.erbegroup.com/us-en/products/cryosurgery/cryoprobes-for-erbecryor-2/flexible-cryoprobe-single-use-oe-11-mm/",
  },
  {
    id: "cryoprobe-1-7",
    displayName: "1.7 mm cryoprobe",
    category: "cryoprobe",
    outerDiameterMm: 1.7,
    notes: [
      "Extraction workflow is device- and technique-dependent.",
    ],
    sourceLabel: "Representative cryoprobe diameter",
    sourceUrl: "https://register.erbe-med.com/productfinder/Marketingmaterialien/85800-133_ERBE_EN_Application_brochure_pneumology__D071914.pdf",
  },
  {
    id: "cryoprobe-2-4",
    displayName: "2.4 mm cryoprobe",
    category: "cryoprobe",
    outerDiameterMm: 2.4,
    notes: [
      "Often requires larger working channel or scope-removal workflow depending on device and technique.",
    ],
    sourceLabel: "Representative cryoprobe diameter",
    sourceUrl: "https://register.erbe-med.com/productfinder/Marketingmaterialien/85800-133_ERBE_EN_Application_brochure_pneumology__D071914.pdf",
  },
];

export const airwayGenerations: AirwayGeneration[] = [
  {
    generation: 0,
    label: "Trachea",
    approximateDiameterMm: 18.0,
  },
  {
    generation: 1,
    label: "Main bronchi",
    approximateDiameterMm: 12.0,
  },
  {
    generation: 2,
    label: "Lobar bronchi",
    approximateDiameterMm: 9.0,
  },
  {
    generation: 3,
    label: "Segmental bronchi",
    approximateDiameterMm: 7.0,
  },
  {
    generation: 4,
    label: "Proximal subsegmental",
    approximateDiameterMm: 5.5,
  },
  {
    generation: 5,
    label: "Subsegmental",
    approximateDiameterMm: 4.5,
  },
  {
    generation: 6,
    label: "Distal subsegmental",
    approximateDiameterMm: 3.5,
  },
  {
    generation: 7,
    label: "Small distal airway",
    approximateDiameterMm: 2.8,
  },
  {
    generation: 8,
    label: "Very small distal airway",
    approximateDiameterMm: 2.2,
  },
];

3. Follow-up Codex prompt for polishing
Use this after the first build is complete.
Review and polish the Bronchoscope Size, Reach & Tool Fit Explorer module.

Focus on:

1. UX clarity
   - Make the educational tradeoff obvious:
     smaller OD = more distal access
     larger channel = better suction/tool capacity

2. Visual quality
   - Ensure SVG circles are proportional.
   - Ensure labels do not overlap.
   - Make mobile layout readable.

3. Medical education language
   - Remove any product-promotional wording.
   - Ensure all claims are educational and appropriately cautious.
   - Ensure robotic platform notes state that reach is not diameter-only.

4. Accessibility
   - Check keyboard navigation.
   - Check semantic buttons and headings.
   - Add ARIA labels where appropriate.
   - Ensure color is not the only indicator of fit/reach.

5. Source display
   - Ensure all preset dimensions and compatibility thresholds have source labels and URLs.
   - Render sources in a compact expandable section if possible.

6. Performance
   - Avoid unnecessary re-renders.
   - Use memoization only where it improves clarity or performance.
   - Do not add heavy dependencies.

Run lint, typecheck, tests, and build. Fix any issues.

4. Follow-up Codex prompt for tests
Add or improve tests for the Bronchoscope Size, Reach & Tool Fit Explorer calculation utilities.

Test these scenarios:

1. circleAreaMm2
   - 2.0 mm diameter should return approximately 3.14 mm².
   - 2.8 mm diameter should return approximately 6.16 mm².

2. getRemainingChannelAreaMm2
   - 2.8 mm channel with 1.1 mm instrument should return positive remaining area.
   - Missing instrument diameter should return null.
   - Instrument larger than channel should not return a negative value.

3. classifyInstrumentFit
   - 2.8 mm channel with minimum 2.8 mm instrument should fit.
   - 2.0 mm channel with minimum 2.6 mm instrument should not fit.
   - 1.7 mm channel with minimum 1.7 mm instrument should fit.
   - Instrument with unknown diameter and no minimumWorkingChannelMm should return unknown.

4. getReachableGenerations
   - Large therapeutic scope should reach fewer generations.
   - Ultrathin scope should reach more generations.
   - Increasing clearanceMm should reduce estimated reach.

5. getEstimatedReachLabel
   - Generations 0-2 should map to central/lobar.
   - Generations 3-4 should map to segmental/proximal subsegmental.
   - Generations 5-6 should map to subsegmental/distal subsegmental.
   - Generations 7+ should map to very distal/small-airway territory.

Use the repository’s existing test framework. If no test framework exists, do not add a new one without explaining the tradeoff. Instead, make the utility functions simple and document manual verification.

5. Follow-up Codex prompt for case-based learning
Extend the Bronchoscope Size, Reach & Tool Fit Explorer with an optional "Clinical Scenario" selector.

Add 4 educational cases:

1. Central airway obstruction with secretion burden
   Teaching point:
   Larger working channel improves suction and therapeutic capability.

2. Peripheral pulmonary nodule requiring radial EBUS confirmation
   Teaching point:
   Thin or ultrathin scopes may improve distal access, but tool size and channel limitations matter.

3. Robotic bronchoscopy for peripheral lesion
   Teaching point:
   Robotic reach depends on diameter, articulation, stability, navigation, and confirmation imaging.

4. Cryobiopsy-sized tissue acquisition
   Teaching point:
   Cryoprobe compatibility and extraction workflow depend on working channel, oversheath, probe size, and technique.

For each scenario:
- Highlight relevant scope classes.
- Highlight relevant instruments.
- Display a short teaching pearl.
- Avoid giving patient-specific medical advice.
- Keep the feature optional and unobtrusive.

6. Follow-up Codex prompt for integrating into site navigation
Integrate the Bronchoscope Size, Reach & Tool Fit Explorer into the website navigation.

Tasks:

1. Inspect existing navigation/sidebar/tool index structure.
2. Add a link to the module using the existing pattern.
3. Suggested title:
   Bronchoscope Size Explorer

4. Suggested description:
   Compare scope diameter, working channel size, airway reach, and tool compatibility.

5. Place it near bronchoscopy, navigation, anatomy, robotic bronchoscopy, or procedural tools, depending on the existing site organization.

6. Ensure the route works in production build.
7. Run lint, typecheck, and build.


````
