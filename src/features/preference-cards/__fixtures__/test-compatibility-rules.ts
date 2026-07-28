import type { TypedCompatibilityRule } from '../domain/types'

/**
 * A rule engineered to fail, used to prove that blocking conflicts and waivers behave.
 *
 * This lived in seed/operational.ts through v0.1, which meant the central-airway scenario
 * was permanently "Blocked" for real users to exercise a test path. Tests now inject it
 * into a copied context instead.
 */
export const intentionallyFailingApcRule: TypedCompatibilityRule = {
  id: 'RULE-APC-PLATFORM-FAMILY',
  sourceRoleCode: 'APC_PROBE_FLEX',
  targetRoleCode: 'GENERIC_ENERGY_PLATFORM',
  sourceAttribute: 'system_family',
  targetAttribute: 'system_family',
  operator: 'eq',
  expectedValue: null,
  unit: null,
  severity: 'blocking',
  message:
    'The intentionally incompatible APC probe fixture does not match the demo APC platform family.',
  missingValueMessage:
    'APC platform/probe compatibility cannot be established from the available structured data.',
  active: true,
  modifierCodes: ['APC'],
  evidenceSourceId: null,
}
