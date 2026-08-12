import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  OPERATIONAL_OUTPUT_DEFINITIONS,
  OPERATIONAL_OUTPUT_SCHEMA_VERSION,
  OPERATIONAL_OUTPUT_TABS,
  type OperationalOutputKey,
} from '@/features/device-intelligence/domain/operational-outputs'
import { getProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import { getAtlasCatalogStore } from '@/features/device-intelligence/server/atlas-store.server'
import {
  CANONICAL_PROCEDURAL_PHASE_ORDER,
  getProcedureWorkspace,
} from '@/features/device-intelligence/server/procedures.server'
import { resolveDemoScenario } from '@/features/preference-cards/data/demo-context.server'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'

describe('read-only operational output registry', () => {
  const workspace = () => getProcedureWorkspace('CHEST_TUBE')!
  const previews = () => {
    const ws = workspace()
    return getProcedureOutputPreviews(ws.procedureCode, ws.scenarioId, ws.formularySummary)!
  }

  it('projects every view and packet from one underlying resolved item set', () => {
    const outputs = previews()
    const roomIds = outputs.roomSetup.payload.groups.flatMap((group) =>
      group.lines.map((line) => line.itemId),
    )
    const nursingIds = outputs.nursing.payload.groups.flatMap((group) =>
      group.phases.flatMap((phase) => phase.lines.map((line) => line.itemId)),
    )
    const trainingIds = outputs.training.payload.groups.flatMap((group) =>
      group.lines.map((line) => line.itemId),
    )
    const packetIds = outputs.setupPacket.payload.roomSetup.flatMap((group) =>
      group.lines.map((line) => line.itemId),
    )
    const manifestIds = outputs.provenanceManifest.payload.requirements
      .filter((entry) => entry.presence === 'active')
      .map((entry) => entry.itemId)

    expect([...roomIds].sort()).toEqual([...nursingIds].sort())
    expect([...roomIds].sort()).toEqual([...trainingIds].sort())
    expect(packetIds).toEqual(roomIds)
    expect([...manifestIds].sort()).toEqual([...roomIds].sort())
    expect(outputs.gaps.payload.projection.requirements.map((row) => row.itemId).sort()).toEqual(
      [...roomIds].sort(),
    )
  })

  it('has one complete typed registry contract with deterministic envelope digests', () => {
    const outputs = previews()
    const keys = Object.keys(OPERATIONAL_OUTPUT_DEFINITIONS) as OperationalOutputKey[]
    expect(Object.keys(outputs)).toEqual(keys)
    expect(new Set(keys.map((key) => outputs[key].definition.id)).size).toBe(keys.length)
    expect(new Set(keys.map((key) => outputs[key].digest)).size).toBe(keys.length)
    expect(OPERATIONAL_OUTPUT_TABS).toEqual(
      keys.flatMap((key) => {
        const tab = OPERATIONAL_OUTPUT_DEFINITIONS[key].tab
        return tab === null ? [] : [tab]
      }),
    )

    for (const key of keys) {
      const output = outputs[key]
      expect(output.definition).toEqual(OPERATIONAL_OUTPUT_DEFINITIONS[key])
      expect(output.common.schemaVersion).toBe(OPERATIONAL_OUTPUT_SCHEMA_VERSION)
      expect(output.common.provenance.state).toBe('release_pinned')
      expect(output.digest).toMatch(/^[a-f0-9]{64}$/)
      expect(output.common).toEqual(outputs.roomSetup.common)
    }
    expect(outputs.gaps.definition.sourceKind).toBe('release_pinned_card_and_current_audit_data')
    expect(outputs.training.definition.sourceKind).toBe('release_pinned_resolved_card')
    expect(outputs.setupPacket.definition.sourceKind).toContain('atlas_cohort_filter')
  })

  it('keeps projectors resolver-free and the server adapter to one resolution call', () => {
    const domainSource = readFileSync(join(__dirname, '../domain/operational-outputs.ts'), 'utf8')
    const serverSource = readFileSync(join(__dirname, '../server/outputs.server.ts'), 'utf8')
    expect(domainSource).not.toMatch(/from ['"].*resolve-card/)
    expect(domainSource).not.toMatch(/\b(?:fetch|localStorage|supabase)\b/)
    expect(serverSource.match(/\bresolveCard\(/g)).toHaveLength(1)
    expect(serverSource).not.toContain('roleByCode')
  })

  it('keeps print isolation and responsive-table expansion in the shared stylesheet', () => {
    const styles = readFileSync(join(__dirname, '../../../styles/globals.css'), 'utf8')
    expect(styles).toContain(
      'body:has(.device-output-print) .device-intelligence-workspace > :not(#outputs)',
    )
    expect(styles).toContain(
      'body:has(.device-output-print) #outputs > section > :not(.device-output-print)',
    )
    expect(styles).toMatch(
      /\.device-output-print \.output-print-group\s*{[^}]*break-inside: avoid;/s,
    )
    expect(styles).toMatch(
      /\.device-output-print \.device-output-scroll\s*{[^}]*overflow: visible !important;/s,
    )
    expect(styles).toMatch(
      /\.device-output-print \.device-output-scroll table\s*{[^}]*min-width: 0 !important;/s,
    )
  })

  it('is content-identical across repeated requests (determinism, no persistence)', () => {
    expect(JSON.stringify(previews())).toEqual(JSON.stringify(previews()))
  })

  it('keeps raw resolver trace, notes, local ids, and live role enrichment out of registry payloads', () => {
    const serialized = JSON.stringify(previews())
    expect(serialized).not.toContain('"whyIncluded"')
    expect(serialized).not.toContain('"notes"')
    expect(serialized).not.toContain('"selectedHospitalItemId"')
    const trainingLines = previews().training.payload.groups.flatMap((group) => group.lines)
    expect(trainingLines.every((line) => line.selectionGuidance === null)).toBe(true)
    expect(trainingLines.every((line) => line.requiresCurrentIfu === null)).toBe(true)
  })

  it('is invariant to drift in live role guidance and IFU metadata', () => {
    const store = getCatalogStore()
    const role = store.roleByCode.get('GENERIC_SUCTION')!
    const original = {
      category: role.category,
      roleName: role.role_name,
      description: role.description,
      selectionGuidance: role.selection_guidance,
      requiresCurrentIfu: role.requires_current_ifu,
    }
    const before = previews()
    try {
      role.category = 'LIVE_ROLE_DRIFT'
      role.role_name = 'LIVE ROLE NAME DRIFT'
      role.description = 'LIVE ROLE DESCRIPTION DRIFT'
      role.selection_guidance = 'LIVE ROLE DRIFT MUST NOT ENTER A RELEASE-PINNED OUTPUT'
      role.requires_current_ifu = !role.requires_current_ifu
      const after = previews()
      expect(JSON.stringify(after)).toBe(JSON.stringify(before))
      expect(Object.values(after).map((output) => output.digest)).toEqual(
        Object.values(before).map((output) => output.digest),
      )
    } finally {
      role.category = original.category
      role.role_name = original.roleName
      role.description = original.description
      role.selection_guidance = original.selectionGuidance
      role.requires_current_ifu = original.requiresCurrentIfu
    }
  })

  it('pins every output to the workspace current release and exact card hashes', () => {
    for (const code of ['CHEST_TUBE', 'EBUS_TBNA', 'THERAPEUTIC_BRONCH'] as const) {
      const ws = getProcedureWorkspace(code)!
      const outputs = getProcedureOutputPreviews(
        ws.procedureCode,
        ws.scenarioId,
        ws.formularySummary,
      )!
      const common = outputs.setupPacket.common
      expect(common.releaseIdentity).toEqual({
        releaseBundleId: ws.releaseBundleId,
        releaseDefinitionHash: ws.releaseDefinitionHash,
        catalogReleaseId: ws.catalogReleaseId,
        resolverContractVersion: expect.any(String),
      })
      expect(common.releaseIdentity.resolverContractVersion).toMatch(/\S/)
      expect(common.provenance.resolvedContentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(common.provenance.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
      expect(common.provenance.snapshotIntegrityHash).toMatch(/^[a-f0-9]{64}$/)
      expect(outputs.provenanceManifest.payload.releaseIdentity).toEqual(common.releaseIdentity)
      expect(outputs.provenanceManifest.payload.card.resolvedContentHash).toBe(
        common.provenance.resolvedContentHash,
      )
      for (const output of Object.values(outputs)) {
        expect(output.common.releaseIdentity).toEqual(common.releaseIdentity)
        expect(output.common.provenance).toEqual(common.provenance)
      }
    }
  })

  it('preserves the existing D1 resolved line behavior while adding the release pin', () => {
    for (const code of ['CHEST_TUBE', 'EBUS_TBNA', 'THERAPEUTIC_BRONCH'] as const) {
      const ws = getProcedureWorkspace(code)!
      const legacy = resolveDemoScenario(ws.scenarioId)
      const outputs = getProcedureOutputPreviews(
        ws.procedureCode,
        ws.scenarioId,
        ws.formularySummary,
      )!
      const roomLineById = new Map(
        outputs.roomSetup.payload.groups.flatMap((group) =>
          group.lines.map((line) => [line.itemId, line] as const),
        ),
      )
      const packetLineById = new Map(
        outputs.setupPacket.payload.roomSetup.flatMap((group) =>
          group.lines.map((line) => [line.itemId, line] as const),
        ),
      )
      expect([...roomLineById.keys()].sort()).toEqual(legacy.items.map((item) => item.id).sort())
      for (const item of legacy.items) {
        expect(roomLineById.get(item.id)).toEqual(
          expect.objectContaining({
            quantityDisplay: item.quantityDisplay,
            openHoldStatus: item.openHoldStatus,
            verificationState: item.verificationState,
          }),
        )
        expect(packetLineById.get(item.id)).toEqual(
          expect.objectContaining({
            roleCode: item.roleCode,
            quantityDisplay: item.quantityDisplay,
            openHoldStatus: item.openHoldStatus,
            requiredness: item.requiredness,
            effectiveRequiredness: item.effectiveRequiredness,
            dependencyRule: item.dependencyRule,
            resolutionState: item.resolutionState,
            verificationState: item.verificationState,
            compatibilityState: item.compatibilityState,
          }),
        )
      }
      expect(outputs.roomSetup.payload.suppressedItems.map((item) => item.itemId)).toEqual(
        legacy.suppressedItems.map((item) => item.id),
      )
    }
  })

  it('quotes only authored text in the training view', () => {
    const outputs = previews()
    for (const group of outputs.training.payload.groups) {
      for (const line of group.lines) {
        expect(typeof line.genericRequirement).toBe('string')
        expect(line.genericRequirement.length).toBeGreaterThan(0)
        expect(line.selectionGuidance).toBeNull()
        expect(line.requiresCurrentIfu).toBeNull()
      }
    }
  })

  it('reports the structural gaps and the empty formulary honestly', () => {
    const gaps = previews().gaps.payload
    expect(gaps.proposalsOnlyRoles).toEqual(['GENERIC_SUCTION'])
    expect(gaps.unmappedRoles).toEqual(['DRESSING_SECUREMENT'])
    expect(gaps.formularySummary.carriedRows).toBe(0)
    expect(gaps.formularySummary.preferredRows).toBe(0)
    // Audit-pinned dimension gap count for CHEST_TUBE's authored-option products.
    expect(gaps.dimensionGapCount).toBe(70)
  })

  it('preserves requiredness, dependencies, states, and source lineage in the packet manifest', () => {
    const outputs = previews()
    const lines = outputs.setupPacket.payload.roomSetup.flatMap((group) => group.lines)
    const manifestById = new Map(
      outputs.setupPacket.payload.provenanceAppendix.requirements.map((entry) => [
        entry.itemId,
        entry,
      ]),
    )
    expect(lines.some((line) => line.dependencyRule !== null)).toBe(true)
    for (const line of lines) {
      expect(manifestById.get(line.itemId)).toEqual(
        expect.objectContaining({
          presence: 'active',
          roleCode: line.roleCode,
          requiredness: line.requiredness,
          effectiveRequiredness: line.effectiveRequiredness,
          conditionalState: line.conditionalState,
          dependencyRule: line.dependencyRule,
          resolutionState: line.resolutionState,
          verificationState: line.verificationState,
          compatibilityState: line.compatibilityState,
        }),
      )
    }
    for (const entry of manifestById.values()) {
      expect(Array.isArray(entry?.sourceModuleVersionIds)).toBe(true)
    }
    const setupLine = lines[0]
    expect(setupLine).not.toHaveProperty('genericRequirement')
    expect(setupLine).not.toHaveProperty('selectionGuidance')
    expect(setupLine).not.toHaveProperty('requiresCurrentIfu')
    expect(setupLine).not.toHaveProperty('whyIncluded')
    expect(setupLine).not.toHaveProperty('notes')
    expect(setupLine).not.toHaveProperty('sourceModuleVersionIds')
    expect(outputs.setupPacket.payload.diagnostics).toEqual(
      outputs.provenanceManifest.payload.diagnostics,
    )
  })

  it('keeps manifest evidence identities behind the existing atlas cohort wall', () => {
    const atlasProductIds = new Set(getAtlasCatalogStore().productById.keys())
    for (const code of ['CHEST_TUBE', 'EBUS_TBNA', 'THERAPEUTIC_BRONCH'] as const) {
      const ws = getProcedureWorkspace(code)!
      const outputs = getProcedureOutputPreviews(
        ws.procedureCode,
        ws.scenarioId,
        ws.formularySummary,
      )!
      for (const entry of outputs.provenanceManifest.payload.requirements) {
        if (entry.evidence.identityState === 'visible') {
          expect(atlasProductIds.has(entry.evidence.catalogProductId)).toBe(true)
        } else {
          expect(entry.evidence).not.toHaveProperty('catalogProductId')
          expect(entry.evidence).not.toHaveProperty('sourceId')
          expect(entry.evidence).not.toHaveProperty('sourceLocation')
          expect(entry.evidence).not.toHaveProperty('verificationStatus')
        }
      }
    }
  })

  it('preserves compatibility unknowns instead of turning missing evidence into a pass', () => {
    const ws = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    const outputs = getProcedureOutputPreviews(
      ws.procedureCode,
      ws.scenarioId,
      ws.formularySummary,
    )!
    const unknownDiagnostics = outputs.setupPacket.payload.diagnostics.filter(
      (diagnostic) => diagnostic.code === 'compatibility_unknown',
    )
    expect(unknownDiagnostics.length).toBeGreaterThan(0)
    expect(outputs.provenanceManifest.payload.diagnostics).toEqual(
      expect.arrayContaining(unknownDiagnostics),
    )
    expect(outputs.gaps.payload.projection.cardDiagnosticCodes).toContain(
      'available_but_unverified',
    )
  })

  it('shows the BOM-suppressed requirement in every operational packet, never silently dropped', () => {
    const outputs = previews()
    expect(outputs.roomSetup.payload.suppressedItems).toEqual([
      expect.objectContaining({
        roleCode: 'LOCAL_CHEST_TUBE_SECUREMENT',
        requiredness: expect.any(String),
        effectiveRequiredness: expect.any(String),
        resolutionState: 'suppressed_by_kit',
        suppression: {
          state: 'verbatim',
          reason: expect.stringContaining('includes this component'),
        },
      }),
    ])
    const suppressed = outputs.roomSetup.payload.suppressedItems[0]
    expect(suppressed.suppression).toEqual({
      state: 'verbatim',
      reason: expect.stringMatching(/^Suppressed because /),
    })
    expect(outputs.nursing.payload.suppressedItems).toEqual(
      outputs.roomSetup.payload.suppressedItems,
    )
    expect(outputs.setupPacket.payload.suppressedItems).toEqual(
      outputs.roomSetup.payload.suppressedItems,
    )
    expect(
      outputs.provenanceManifest.payload.requirements.find(
        (entry) => entry.itemId === suppressed.itemId,
      ),
    ).toEqual(expect.objectContaining({ presence: 'suppressed_by_kit' }))
  })

  it('orders training and nursing phase groups by the canonical clinical sequence', () => {
    const therapeutic = getProcedureWorkspace('THERAPEUTIC_BRONCH')!
    const outputs = getProcedureOutputPreviews(
      therapeutic.procedureCode,
      therapeutic.scenarioId,
      therapeutic.formularySummary,
    )!
    const rank = (phase: string) => CANONICAL_PROCEDURAL_PHASE_ORDER.indexOf(phase)
    const trainingRanks = outputs.training.payload.groups.map((group) => rank(group.key))
    expect(trainingRanks).not.toContain(-1)
    expect(trainingRanks).toEqual([...trainingRanks].sort((left, right) => left - right))
    const keys = outputs.training.payload.groups.map((group) => group.key)
    if (keys.includes('airway_access') && keys.includes('therapeutic')) {
      expect(keys.indexOf('airway_access')).toBeLessThan(keys.indexOf('therapeutic'))
    }
    for (const group of outputs.nursing.payload.groups) {
      const ranks = group.phases.map((phase) => rank(phase.key))
      expect(ranks).toEqual([...ranks].sort((left, right) => left - right))
    }
  })

  it('rejects non-exemplar procedures', () => {
    const ws = workspace()
    expect(
      getProcedureOutputPreviews('BRONCH_ABLATION', ws.scenarioId, ws.formularySummary),
    ).toBeNull()
  })

  it('keeps the preference-card output as a link to the existing builder scenario', () => {
    const outputs = previews()
    expect(outputs.preferenceCard.payload).toEqual({
      scenarioId: 'chest-tube',
      behavior: 'existing_builder_link',
    })
    expect(getProcedureWorkspace('EBUS_TBNA')!.scenarioId).toBe('ebus-rose-molecular')
    expect(getProcedureWorkspace('THERAPEUTIC_BRONCH')!.scenarioId).toBe(
      'central-airway-obstruction',
    )
  })
})
