import 'server-only'

import { getTranslations } from 'next-intl/server'

import type { ProductStatusLabels } from '@/features/device-intelligence/components/ProductStatus'
import {
  MARKET_CONFIDENCES,
  MARKET_STATUSES,
  SAFETY_ACTION_SCOPES,
  SAFETY_DISPLAYS,
  STATUS_RECOMMENDATION_GATES,
} from '@/features/device-intelligence/domain/product-status'

/**
 * One resolver for the D2B market/safety copy, shared by the atlas index, the product page,
 * the role page, and the procedure workspaces.
 *
 * Every label is keyed by a controlled vocabulary value, so a new market status or safety
 * state cannot ship without its localized wording: the record types below are exhaustive and
 * `type-check` fails on a missing key.
 */
export async function getProductStatusLabels(locale: string): Promise<ProductStatusLabels> {
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.status' })
  const fromKeys = <Key extends string>(keys: readonly Key[], prefix: string) =>
    Object.fromEntries(keys.map((key) => [key, t(`${prefix}.${key}` as never)])) as Record<
      Key,
      string
    >

  return {
    market: fromKeys(MARKET_STATUSES, 'market'),
    marketBadge: fromKeys(MARKET_STATUSES, 'marketBadge'),
    safety: fromKeys(SAFETY_DISPLAYS, 'safety'),
    safetyDetail: fromKeys(SAFETY_DISPLAYS, 'safetyDetail'),
    scope: fromKeys(SAFETY_ACTION_SCOPES, 'scope'),
    gate: fromKeys(STATUS_RECOMMENDATION_GATES, 'gate'),
    gateDetail: fromKeys(STATUS_RECOMMENDATION_GATES, 'gateDetail'),
    confidenceValue: fromKeys(MARKET_CONFIDENCES, 'confidenceValue'),
    panelHeading: t('panelHeading'),
    marketHeading: t('marketHeading'),
    safetyHeading: t('safetyHeading'),
    gateHeading: t('gateHeading'),
    gateNote: t('gateNote'),
    confidenceLabel: t('confidenceLabel'),
    snapshotLabel: t('snapshotLabel'),
    notResearched: t('notResearched'),
    orderabilityNote: t('orderabilityNote'),
    lotSpecificNote: t('lotSpecificNote'),
    referenceCodesLabel: t('referenceCodesLabel'),
    activeNoticeHeading: t('activeNoticeHeading'),
    marketBadgeA11yPrefix: t('marketBadgeA11yPrefix'),
    safetyBadgeA11yPrefix: t('safetyBadgeA11yPrefix'),
  }
}
