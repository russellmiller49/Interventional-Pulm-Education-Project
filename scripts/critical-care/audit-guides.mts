/**
 * Audit of every authored number this resource interprets for a learner.
 *
 * Prints each guide, each interpretation rule, each measurement clarification and each held
 * disagreement with the provenance behind it, then fails on the structural defects that would let
 * an unsourced or miscategorised number reach a fellow.
 *
 *   npm run audit:critical-care-guides
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import {
  allCriticalCareDerivedValueGuides,
  criticalCareReferenceKindLabels,
  validateCriticalCareDerivedValueGuides,
} from '../../src/features/critical-care/content/derivedValueGuides.ts'
import { criticalCareEvidenceById } from '../../src/features/critical-care/content/evidenceRegistry.ts'
import {
  criticalCareMeasurementClarifications,
  validateCriticalCareMeasurementClarifications,
} from '../../src/features/critical-care/content/measurementClarifications.ts'
import {
  criticalCareSourceConflicts,
  validateCriticalCareSourceConflicts,
} from '../../src/features/critical-care/content/sourceConflicts.ts'
// Importing the module bindings is what populates the shared registry.
import '../../src/features/mechanical-circulatory-support/content/derivedValueGuides.ts'

const failures: string[] = []

/**
 * Files still using the pre-migration field names.
 *
 * Allowlisted by exact path rather than skipped silently: each entry is outstanding migration work
 * and is reported on every run.
 */
const LEGACY_FIELD_ALLOWLIST: Readonly<Record<string, string>> = {
  'src/features/icu-hemodynamics/content/derivedValueGuides.ts':
    '13 hemodynamic guides not yet migrated to the shared context-aware model',
  'src/features/icu-hemodynamics/components/FormulaDrawer.tsx':
    'renders the legacy hemodynamic guide shape',
  'src/features/icu-hemodynamics/components/PacMeasurementTeaching.tsx':
    'renders the legacy hemodynamic guide shape',
  'src/features/icu-hemodynamics/__tests__/clinical-consistency.test.ts':
    'asserts against the legacy hemodynamic guide shape',
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

function auditLegacyFields(): void {
  const roots = ['src/features/critical-care', 'src/features/mechanical-circulatory-support']
  const outstanding: string[] = []
  for (const [path, reason] of Object.entries(LEGACY_FIELD_ALLOWLIST)) {
    outstanding.push(`  ${path} — ${reason}`)
  }
  for (const root of roots) {
    for (const file of walk(root)) {
      const relative = file.replace(/^.*?(src\/)/, '$1')
      if (relative in LEGACY_FIELD_ALLOWLIST) continue
      // Strip comments first: a doc comment explaining why the field names were retired is not a
      // use of them, and failing on prose would make the check unfixable by documenting it.
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      if (/(^|[^\w.])(normalRange|actionableThresholds)\s*[:?]/m.test(code) || /\.(normalRange|actionableThresholds)\b/.test(code)) {
        failures.push(`legacy guide field in active source: ${relative}`)
      }
    }
  }
  console.log('\nOutstanding migrations (allowlisted, not failures):')
  for (const line of outstanding) console.log(line)
}

console.log('\n=== Derived-value guides ===')
const guides = allCriticalCareDerivedValueGuides()
failures.push(...validateCriticalCareDerivedValueGuides(guides))

for (const guide of guides) {
  const owner = guide.id.includes('.') ? guide.id.split('.')[0] : 'shared'
  console.log(
    `\n${guide.id}  [owner: ${owner}]  ${guide.label}${guide.unit ? ` (${guide.unit})` : ''}`,
  )
  console.log(`  live value : ${guide.liveValueType}`)
  if (guide.formula) console.log(`  formula    : ${guide.formula}`)
  console.log(`  review     : ${guide.reviewStatus}`)
  console.log(`  caveats    : ${guide.caveats}`)
  console.log(`  do not infer: ${guide.doNotInfer}`)

  for (const reference of guide.references) {
    console.log(
      `  ref ${reference.id}\n    kind      : ${reference.kind} (${criticalCareReferenceKindLabels[reference.kind]})\n    statement : ${reference.statement}\n    appliesWhen: ${reference.appliesWhen}\n    evidence  : ${reference.evidenceIds.join(', ')}`,
    )
    for (const evidenceId of reference.evidenceIds) {
      if (!criticalCareEvidenceById.has(evidenceId)) {
        failures.push(`${guide.id}/${reference.id}: unresolved evidence id ${evidenceId}`)
      }
    }
  }

  for (const rule of guide.rules ?? []) {
    const interval = rule.interval
      ? Object.entries(rule.interval)
          .map(([key, bound]) => `${key} ${bound}`)
          .join(', ')
      : 'fallback (no interval)'
    console.log(`  rule ${rule.id}\n    interval  : ${interval}\n    statement : ${rule.statement}\n    refs      : ${rule.referenceIds.join(', ')}`)
  }
}

console.log('\n=== Measurement clarifications ===')
failures.push(
  ...validateCriticalCareMeasurementClarifications(criticalCareMeasurementClarifications),
)
for (const clarification of criticalCareMeasurementClarifications) {
  console.log(`\n${clarification.id}  [${clarification.reviewStatus}]  ${clarification.title}`)
  for (const quantity of clarification.quantities) {
    console.log(
      `  ${quantity.valueText.padEnd(16)} measures: ${quantity.measurand}\n    condition: ${quantity.condition ?? '—'}\n    source   : ${quantity.source}, ${quantity.locator}\n    evidence : ${quantity.evidenceIds.join(', ')}`,
    )
    for (const evidenceId of quantity.evidenceIds) {
      if (!criticalCareEvidenceById.has(evidenceId)) {
        failures.push(`${clarification.id}: unresolved evidence id ${evidenceId}`)
      }
    }
  }
  console.log(`  teaching point: ${clarification.teachingPoint}`)

  // A clarification whose quantities all describe the same measurand is really a disagreement.
  const measurands = new Set(clarification.quantities.map((quantity) => quantity.measurand))
  if (measurands.size < 2) {
    failures.push(
      `${clarification.id}: every quantity names the same measurand — this is a disagreement, not a clarification`,
    )
  }
}

console.log('\n=== Held disagreements ===')
failures.push(...validateCriticalCareSourceConflicts(criticalCareSourceConflicts))
for (const conflict of criticalCareSourceConflicts) {
  console.log(`\n${conflict.id}  [${conflict.reviewStatus}]  ${conflict.title}`)
  for (const position of conflict.positions) {
    console.log(
      `  ${position.claim}\n    source  : ${position.source}, ${position.locator}\n    evidence: ${position.evidenceIds.join(', ')}`,
    )
    for (const evidenceId of position.evidenceIds) {
      if (!criticalCareEvidenceById.has(evidenceId)) {
        failures.push(`${conflict.id}: unresolved evidence id ${evidenceId}`)
      }
    }
  }
  console.log(`  handling: ${conflict.handling}`)
}

// The specific regression this split exists to prevent: manufacturer measurands filed as a conflict.
const impellaConflict = criticalCareSourceConflicts.find((conflict) =>
  conflict.id.includes('impella-cp'),
)
if (impellaConflict && impellaConflict.positions.length > 2) {
  failures.push(
    `${impellaConflict.id}: more than two positions — different measurands belong in a measurement clarification`,
  )
}
if (impellaConflict?.positions.some((position) => /4\.3|3\.7/.test(position.claim))) {
  failures.push(
    `${impellaConflict.id}: manufacturer mean/peak figures are filed as competing positions`,
  )
}

auditLegacyFields()

console.log(`\n${failures.length} failure(s)`)
for (const failure of failures) console.log(`  ${failure}`)
if (failures.length > 0) process.exit(1)
