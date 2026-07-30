import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import rolesJson from '../../data/ip-preference-cards/generated/roles.json'
import standInsJson from '../../data/ip-preference-cards/seed/demo-stand-ins.json'
import {
  buildDemoContext,
  getScenarioDefinitions,
  resolveDemoScenario,
} from '../../src/features/preference-cards/data/demo-context.server'
import {
  demoHospitalItemSeeds,
  operationalModifiers,
} from '../../src/features/preference-cards/seed/operational'
import { formatJson } from './format-json'

interface CoverageReport {
  procedures: {
    procedureCode: string
    slotCoverage: {
      roleCode: string
      requiredness: string
      hasCuratedDefault: boolean
      allowCustom: boolean
    }[]
  }[]
}
interface DemoStandIn {
  id: string
  role_code: string
  local_description: string
  reason: string
}

interface RoleRow {
  role_code: string
}

const DEMO_SEED_COVERAGE_PROCEDURES = new Set([
  'EBUS_TBNA',
  'CHEST_TUBE',
  'THERAPEUTIC_BRONCH',
  'RIGID_BRONCH',
])

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export async function validateDemoSeed() {
  const generatedDirectory = path.resolve(
    process.cwd(),
    process.env.IP_CARDS_OUTPUT_DIR ?? 'data/ip-preference-cards/generated',
  )
  const coverage = JSON.parse(
    await readFile(path.join(generatedDirectory, 'coverage-report.json'), 'utf8'),
  ) as CoverageReport
  const standIns = standInsJson as DemoStandIn[]
  const roles = rolesJson as RoleRow[]
  const errors: string[] = []

  const itemIdDuplicates = duplicates(demoHospitalItemSeeds.map((item) => item.id))
  if (itemIdDuplicates.length > 0) {
    errors.push(`Duplicate demo hospital item IDs: ${itemIdDuplicates.join(', ')}`)
  }

  const modifierCodeDuplicates = duplicates(operationalModifiers.map((modifier) => modifier.code))
  if (modifierCodeDuplicates.length > 0) {
    errors.push(`Duplicate modifier codes: ${modifierCodeDuplicates.join(', ')}`)
  }

  const roleCodes = new Set(roles.map((role) => role.role_code))
  const collisions = operationalModifiers
    .map((modifier) => modifier.code)
    .filter((code) => roleCodes.has(code))
  if (collisions.length > 0) {
    errors.push(`Modifier codes collide with catalog roles: ${collisions.join(', ')}`)
  }

  const demoOnlySeeds = demoHospitalItemSeeds.filter(
    (item) => item.verificationState === 'demo_only',
  )
  const standInIds = new Set(standIns.map((standIn) => standIn.id))
  const demoOnlyIds = new Set(demoOnlySeeds.map((item) => item.id))
  const missingStandIns = demoOnlySeeds
    .filter((item) => !standInIds.has(item.id))
    .map((item) => item.id)
  const staleStandIns = standIns
    .filter((standIn) => !demoOnlyIds.has(standIn.id))
    .map((standIn) => standIn.id)
  if (missingStandIns.length > 0) {
    errors.push(
      `Demo-only records missing from the reviewed stand-in list: ${missingStandIns.join(', ')}`,
    )
  }
  if (staleStandIns.length > 0) {
    errors.push(`Reviewed stand-in entries have no demo-only record: ${staleStandIns.join(', ')}`)
  }

  const mappedRoles = new Set(demoHospitalItemSeeds.map((item) => item.roleCode))
  const demoCoverageProcedures = coverage.procedures.filter((procedure) =>
    DEMO_SEED_COVERAGE_PROCEDURES.has(procedure.procedureCode),
  )
  const uncoveredRequiredRoles = demoCoverageProcedures.flatMap((procedure) =>
    procedure.slotCoverage.flatMap((slot) =>
      slot.requiredness === 'required' &&
      !slot.hasCuratedDefault &&
      !mappedRoles.has(slot.roleCode) &&
      !slot.allowCustom
        ? [`${procedure.procedureCode}:${slot.roleCode}`]
        : [],
    ),
  )
  if (uncoveredRequiredRoles.length > 0) {
    errors.push(
      `Required roles without curated defaults lack an explicit demo resolution: ${uncoveredRequiredRoles.join(', ')}`,
    )
  }

  const scenarioResults = getScenarioDefinitions().map((scenario) => {
    const context = buildDemoContext(scenario.id)
    const hiddenItems = context.hospitalItems
      .filter((item) => item.verificationState === 'hidden')
      .map((item) => item.id)
    if (hiddenItems.length > 0) {
      errors.push(`${scenario.id} maps hidden catalog products: ${hiddenItems.join(', ')}`)
    }

    const card = resolveDemoScenario(scenario.id)
    return {
      id: scenario.id,
      readiness_state: card.readinessState,
      snapshot_hash: card.snapshotHash,
      item_count: card.items.length,
      suppressed_item_count: card.suppressedItems.length,
      blocking_codes: card.warnings
        .filter((warning) => warning.severity === 'blocking')
        .map((warning) => warning.code),
    }
  })

  const ebus = scenarioResults.find((scenario) => scenario.id === 'ebus-rose-molecular')
  const chestTube = scenarioResults.find((scenario) => scenario.id === 'chest-tube')
  const central = scenarioResults.find((scenario) => scenario.id === 'central-airway-obstruction')
  if (ebus?.readiness_state === 'blocked') {
    errors.push('The EBUS golden scenario should not be blocked by seed coverage.')
  }
  if (chestTube?.readiness_state === 'blocked') {
    errors.push('The default chest-tube golden scenario should not be blocked.')
  }
  if (central?.readiness_state === 'blocked') {
    errors.push('The default central-airway-obstruction scenario should not be blocked.')
  }
  if ((chestTube?.suppressed_item_count ?? 0) < 1) {
    errors.push('The chest-tube small-bore fixture must prove kit/BOM suppression.')
  }

  const summary = {
    format_version: 1,
    demo_profile: {
      organization: 'Demo IP Program',
      site: 'Demo Hospital',
      location: 'Bronchoscopy Suite 1',
    },
    demo_only_stand_ins: demoOnlySeeds.length,
    explicitly_resolved_required_roles_without_curated_defaults: demoCoverageProcedures.reduce(
      (total, procedure) =>
        total +
        procedure.slotCoverage.filter(
          (slot) =>
            slot.requiredness === 'required' &&
            !slot.hasCuratedDefault &&
            (mappedRoles.has(slot.roleCode) || slot.allowCustom),
        ).length,
      0,
    ),
    scenarios: scenarioResults,
  }

  if (errors.length > 0) {
    throw new Error(`Demo seed validation failed:\n${errors.join('\n')}`)
  }

  await writeFile(
    path.join(generatedDirectory, 'demo-seed-summary.json'),
    await formatJson(summary),
  )
  return summary
}

if (process.argv[1] && /validate-seed\.(?:ts|js)$/.test(process.argv[1])) {
  validateDemoSeed()
    .then((summary) => {
      console.log('IP preference-card demo seed is valid.')
      console.log(JSON.stringify(summary, null, 2))
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
