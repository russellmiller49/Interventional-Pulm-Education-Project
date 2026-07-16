import { crrtProtocolProfileSchema, type CrrtProtocolProfile } from './schema'

const missingCitrateRequirements = Object.freeze([
  'A versioned local citrate-calcium protocol',
  'Approved solution and concentration inventory',
  'Reviewed citrate and calcium adjustment rules',
  'Reviewed systemic and circuit ionized-calcium targets',
  'Reviewed laboratory timing and escalation rules',
])

const emptySourceRecordIds: CrrtProtocolProfile['sourceRecordIds'] = []
const emptyParameterValues: CrrtProtocolProfile['parameterValues'] = []
Object.freeze(emptySourceRecordIds)
Object.freeze(emptyParameterValues)

const parsedDisabledCitrateProfile = crrtProtocolProfileSchema.parse({
  id: 'PROTO-001',
  displayName: 'Regional citrate-calcium protocol placeholder',
  kind: 'regional-citrate-calcium',
  protocolVersion: null,
  enabled: false,
  reviewStatus: 'pending',
  sourceRecordIds: emptySourceRecordIds,
  parameterValues: emptyParameterValues,
  missingRequirements: missingCitrateRequirements,
  blockedReason:
    'No versioned local citrate-calcium protocol has been supplied or approved for this module.',
})

Object.freeze(parsedDisabledCitrateProfile.sourceRecordIds)
Object.freeze(parsedDisabledCitrateProfile.parameterValues)
Object.freeze(parsedDisabledCitrateProfile.missingRequirements)

export const disabledCitrateProtocolProfile: CrrtProtocolProfile = Object.freeze(
  parsedDisabledCitrateProfile,
)

export const baxterCrrtProtocolProfiles = Object.freeze([disabledCitrateProtocolProfile])
