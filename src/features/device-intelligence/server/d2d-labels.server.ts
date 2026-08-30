import 'server-only'

import { getTranslations } from 'next-intl/server'

import type { D2dEvidenceLabels } from '@/features/device-intelligence/components/D2dEvidencePanels'
import { D2D_SOURCE_KINDS } from '@/features/device-intelligence/domain/evidence-source-schema'
import {
  DESCRIPTION_SCOPES,
  D2D_CONFIDENCES,
} from '@/features/device-intelligence/domain/product-profile'
import {
  COMMERCIAL_DISTRIBUTION_STATES,
  DEVICE_CLASSES,
  REGULATORY_CONCLUSION_CODES,
  REGULATORY_MATCH_LEVELS,
  REGULATORY_RESEARCH_STATES,
} from '@/features/device-intelligence/domain/product-regulatory'

type EvidenceScope = keyof D2dEvidenceLabels['shared']['evidenceScope']
type RegulatoryPathway = keyof D2dEvidenceLabels['regulatory']['pathway']
type RegulatoryPathwayDecision = keyof D2dEvidenceLabels['regulatory']['pathwayDecision']
type RegistrationListingStatus = keyof D2dEvidenceLabels['regulatory']['registrationListingStatus']

/**
 * These closed records cover unions derived from the overlay schemas rather than exported
 * vocabulary arrays. A schema addition therefore fails type-check until localized copy exists.
 */
const EVIDENCE_SCOPES: Record<EvidenceScope, true> = {
  exact: true,
  family: true,
  configuration: true,
  product_code: true,
}

const REGULATORY_PATHWAYS: Record<RegulatoryPathway, true> = {
  '510k': true,
  pma: true,
  de_novo: true,
  hde: true,
  premarket_exempt: true,
}

const REGULATORY_PATHWAY_DECISIONS: Record<RegulatoryPathwayDecision, true> = {
  substantially_equivalent: true,
  not_substantially_equivalent: true,
  withdrawn: true,
  unknown: true,
  approved: true,
  denied: true,
  granted: true,
  declined: true,
  exempt: true,
}

const REGISTRATION_LISTING_STATUSES: Record<RegistrationListingStatus, true> = {
  listed: true,
  not_found: true,
  unknown: true,
}

/**
 * Resolve every D2D label on the server before rendering either evidence panel.
 *
 * Reviewed profile claims, source titles, identifiers, units, and exact locators never pass
 * through this resolver: they remain the physician-owner-approved English artifact content.
 * Only UI chrome and controlled vocabulary labels are localized here.
 */
export async function getD2dEvidenceLabels(locale: string): Promise<D2dEvidenceLabels> {
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.d2d' })
  const fromKeys = <Key extends string>(keys: readonly Key[], prefix: string) =>
    Object.fromEntries(keys.map((key) => [key, t(`${prefix}.${key}` as never)])) as Record<
      Key,
      string
    >
  const recordKeys = <Key extends string>(record: Record<Key, true>) => Object.keys(record) as Key[]

  return {
    shared: {
      confidenceLabel: t('shared.confidenceLabel'),
      asOfDateLabel: t('shared.asOfDateLabel'),
      evidenceScopeLabel: t('shared.evidenceScopeLabel'),
      confidence: fromKeys(D2D_CONFIDENCES, 'shared.confidence'),
      evidenceScope: fromKeys(recordKeys(EVIDENCE_SCOPES), 'shared.evidenceScope'),
    },
    profile: {
      heading: t('profile.heading'),
      summaryHeading: t('profile.summaryHeading'),
      scopeLabel: t('profile.scopeLabel'),
      scope: fromKeys(DESCRIPTION_SCOPES, 'profile.scope'),
      scopeNotice: fromKeys(
        ['configuration_variant', 'family_inherited'] as const,
        'profile.scopeNotice',
      ),
      contentLanguageNotice: t('profile.contentLanguageNotice'),
      physicalDeviceTypeLabel: t('profile.physicalDeviceTypeLabel'),
      intendedFunctionLabel: t('profile.intendedFunctionLabel'),
      exactConfigurationLabel: t('profile.exactConfigurationLabel'),
      keySpecificationsHeading: t('profile.keySpecificationsHeading'),
    },
    regulatory: {
      heading: t('regulatory.heading'),
      researchStateLabel: t('regulatory.researchStateLabel'),
      researchState: fromKeys(REGULATORY_RESEARCH_STATES, 'regulatory.researchState'),
      researchAsOfDateLabel: t('regulatory.researchAsOfDateLabel'),
      matchLevelLabel: t('regulatory.matchLevelLabel'),
      matchLevel: fromKeys(REGULATORY_MATCH_LEVELS, 'regulatory.matchLevel'),
      conclusionsHeading: t('regulatory.conclusionsHeading'),
      conclusion: fromKeys(REGULATORY_CONCLUSION_CODES, 'regulatory.conclusion'),
      familyLevelNotice: t('regulatory.familyLevelNotice'),
      udiHeading: t('regulatory.udiHeading'),
      udiRecordLabel: t('regulatory.udiRecordLabel'),
      classificationsHeading: t('regulatory.classificationsHeading'),
      classificationRecordLabel: t('regulatory.classificationRecordLabel'),
      pathwaysHeading: t('regulatory.pathwaysHeading'),
      pathwayRecordLabel: t('regulatory.pathwayRecordLabel'),
      registrationListingHeading: t('regulatory.registrationListingHeading'),
      registrationListingRecordLabel: t('regulatory.registrationListingRecordLabel'),
      commercialDistributionHeading: t('regulatory.commercialDistributionHeading'),
      commercialDistributionRecordLabel: t('regulatory.commercialDistributionRecordLabel'),
      commercialDistributionDisclaimer: t('regulatory.commercialDistributionDisclaimer'),
      fields: {
        primaryDi: t('regulatory.fields.primaryDi'),
        packageDis: t('regulatory.fields.packageDis'),
        issuingAgency: t('regulatory.fields.issuingAgency'),
        legalManufacturer: t('regulatory.fields.legalManufacturer'),
        brandName: t('regulatory.fields.brandName'),
        modelCatalogNumber: t('regulatory.fields.modelCatalogNumber'),
        publishDate: t('regulatory.fields.publishDate'),
        productCode: t('regulatory.fields.productCode'),
        deviceClass: t('regulatory.fields.deviceClass'),
        regulationNumber: t('regulatory.fields.regulationNumber'),
        classificationName: t('regulatory.fields.classificationName'),
        pathway: t('regulatory.fields.pathway'),
        submissionNumber: t('regulatory.fields.submissionNumber'),
        decision: t('regulatory.fields.decision'),
        decisionDate: t('regulatory.fields.decisionDate'),
        establishmentRegistrationNumber: t('regulatory.fields.establishmentRegistrationNumber'),
        listingNumber: t('regulatory.fields.listingNumber'),
        proprietaryName: t('regulatory.fields.proprietaryName'),
        status: t('regulatory.fields.status'),
        recordAsOfDate: t('regulatory.fields.recordAsOfDate'),
      },
      deviceClass: fromKeys(DEVICE_CLASSES, 'regulatory.deviceClass'),
      pathway: fromKeys(recordKeys(REGULATORY_PATHWAYS), 'regulatory.pathway'),
      pathwayDecision: fromKeys(
        recordKeys(REGULATORY_PATHWAY_DECISIONS),
        'regulatory.pathwayDecision',
      ),
      registrationListingStatus: fromKeys(
        recordKeys(REGISTRATION_LISTING_STATUSES),
        'regulatory.registrationListingStatus',
      ),
      commercialDistribution: fromKeys(
        COMMERCIAL_DISTRIBUTION_STATES,
        'regulatory.commercialDistribution',
      ),
    },
    citations: {
      heading: t('citations.heading'),
      referenceLabel: t('citations.referenceLabel'),
      sourceKindLabel: t('citations.sourceKindLabel'),
      sourceKind: fromKeys(D2D_SOURCE_KINDS, 'citations.sourceKind'),
      organizationLabel: t('citations.organizationLabel'),
      snapshotDateLabel: t('citations.snapshotDateLabel'),
      locatorsLabel: t('citations.locatorsLabel'),
      openOfficialSource: t('citations.openOfficialSource'),
      externalSiteLabel: t('citations.externalSiteLabel'),
    },
    fallback: {
      heading: t('fallback.heading'),
      profileUnavailable: t('fallback.profileUnavailable'),
      regulatoryNotResearched: t('fallback.regulatoryNotResearched'),
    },
  }
}
