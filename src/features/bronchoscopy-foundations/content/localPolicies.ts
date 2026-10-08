import { MANIFEST_LOCAL_POLICIES } from '../data/generated/localPolicies.generated'

/**
 * The sixteen places where an institution's own policy applies. Each is a slot: when the
 * institution's wording is configured (`INSTITUTION_POLICIES`), the lesson shows it on the card
 * that depends on it; when it is not, the lesson shows nothing extra and teaches the guideline
 * value from the numbers register. The Reference page lists every slot.
 */
export type LocalPolicyId =
  | 'sedation_policy'
  | 'topical_anesthetic_policy'
  | 'fasting_and_aspiration_policy'
  | 'antithrombotic_policy'
  | 'scope_ifu'
  | 'bal_protocol'
  | 'specimen_directory'
  | 'bleeding_rescue'
  | 'infection_precautions'
  | 'radiation_policy'
  | 'recovery_and_followup'
  | 'icu_bronchoscopy_policy'
  | 'blocker_ifu_and_rescue'
  | 'critical_airway_pathway'
  | 'tracheostomy_assistance_policy'
  | 'cryotherapy_ifu'

export interface LocalPolicy {
  readonly id: LocalPolicyId
  readonly title: string
  readonly description: string
  readonly missingBehavior: string
  /** The institution's own wording, when configured. */
  readonly value: string | null
}

/** The institution's policies, by slot. Empty until the institution sets one. */
export const INSTITUTION_POLICIES: Partial<Readonly<Record<LocalPolicyId, string>>> = {}

const TITLES: Readonly<Record<LocalPolicyId, string>> = {
  sedation_policy: 'Sedation pathway',
  topical_anesthetic_policy: 'Topical anesthetic accounting',
  fasting_and_aspiration_policy: 'Fasting and aspiration risk',
  antithrombotic_policy: 'Antithrombotic interruption and resumption',
  scope_ifu: 'Scope instructions for use',
  bal_protocol: 'Lavage protocol',
  specimen_directory: 'Specimen directory',
  bleeding_rescue: 'Bleeding response',
  infection_precautions: 'Transmission precautions',
  radiation_policy: 'Radiation protection',
  recovery_and_followup: 'Recovery and follow-up',
  icu_bronchoscopy_policy: 'Bronchoscopy in ventilated patients',
  blocker_ifu_and_rescue: 'Bronchial blocker use and rescue',
  critical_airway_pathway: 'Critical central-airway pathway',
  tracheostomy_assistance_policy: 'Tracheostomy assistance',
  cryotherapy_ifu: 'Cryotherapy instructions for use',
}

const DESCRIPTIONS: Partial<Record<LocalPolicyId, string>> = {
  fasting_and_aspiration_policy:
    'Current fasting requirements and evaluation of aspiration risk, including altered gastric emptying',
  specimen_directory:
    'Local containers, required material, transport, specialized laboratory studies and contact pathway',
}

export const LOCAL_POLICIES: readonly LocalPolicy[] = MANIFEST_LOCAL_POLICIES.map((policy) => {
  const id = policy.id as LocalPolicyId
  if (!(id in TITLES)) throw new Error(`Unknown local policy ${policy.id}`)
  return {
    id,
    title: TITLES[id],
    description: DESCRIPTIONS[id] ?? policy.description,
    missingBehavior: policy.missingBehavior,
    value: INSTITUTION_POLICIES[id] ?? null,
  }
})

export const LOCAL_POLICY_BY_ID: ReadonlyMap<string, LocalPolicy> = new Map(
  LOCAL_POLICIES.map((policy) => [policy.id, policy] as const),
)

/** The slots among these that the institution has configured, in the order given. */
export function configuredLocalPolicies(ids: readonly string[]): readonly LocalPolicy[] {
  return ids.flatMap((id) => {
    const policy = LOCAL_POLICY_BY_ID.get(id)
    return policy && policy.value !== null ? [policy] : []
  })
}

/** Said once, on the Reference page, beside the list of slots. */
export const LOCAL_POLICY_NOT_CONFIGURED =
  'Not configured. Lessons teach the guideline value; your institution’s approved policy and the device’s instructions apply.'
