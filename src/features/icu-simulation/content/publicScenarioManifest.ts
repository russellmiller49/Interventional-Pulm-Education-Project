/**
 * Public, immutable metadata for compatibility checks outside the private ICU Simulator bundle.
 *
 * Do not add patient state, answer keys, scoring rules, actions, device settings, replay data, or
 * masked assessment content here. Full scenario definitions remain behind the ICU Simulator
 * release boundary in `scenarios.ts`.
 */
export interface PublicIcuScenarioManifestEntry {
  readonly id: string
  readonly version: string
}

export const publicIcuScenarioManifest = Object.freeze([
  {
    id: 'hemorrhagic',
    version: '1.0.0',
  },
  {
    id: 'tamponade',
    version: '1.0.0',
  },
  {
    id: 'lv-cardiogenic',
    version: '1.0.0',
  },
  {
    id: 'massive-pe-rv',
    version: '1.0.0',
  },
  {
    id: 'septic-ards-aki',
    version: '1.0.0',
  },
  {
    id: 'mixed-cardiogenic-vasodilatory',
    version: '1.0.0',
  },
] as const satisfies readonly PublicIcuScenarioManifestEntry[])

export const publicIcuScenarioManifestById: ReadonlyMap<string, PublicIcuScenarioManifestEntry> =
  new Map(publicIcuScenarioManifest.map((scenario) => [scenario.id, scenario]))
