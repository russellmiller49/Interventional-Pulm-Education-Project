import { MANIFEST_LOCAL_POLICIES } from '../data/generated/localPolicies.generated'

/**
 * The sixteen local-policy inputs the knowledge specification leaves unconfigured. The value of
 * every one is null: this course explains the concept and never calculates for a patient from a
 * number it was not given (A11, A27). A section names the policies its teaching depends on, and
 * the Teaching panel says, on the block, that the institution's version applies.
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
  /** Always null in this course. */
  readonly value: null
}

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

export const LOCAL_POLICIES: readonly LocalPolicy[] = MANIFEST_LOCAL_POLICIES.map((policy) => {
  const id = policy.id as LocalPolicyId
  if (!(id in TITLES)) throw new Error(`Unknown local policy ${policy.id}`)
  return {
    id,
    title: TITLES[id],
    description: policy.description,
    missingBehavior: policy.missingBehavior,
    value: null,
  }
})

export const LOCAL_POLICY_BY_ID: ReadonlyMap<string, LocalPolicy> = new Map(
  LOCAL_POLICIES.map((policy) => [policy.id, policy] as const),
)

export const LOCAL_POLICY_NOT_CONFIGURED =
  'Not configured. This course explains the concept; your institution’s approved policy and the device’s instructions apply, and nothing here calculates for a patient.'
