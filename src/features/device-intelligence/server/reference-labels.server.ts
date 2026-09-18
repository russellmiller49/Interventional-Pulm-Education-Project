import 'server-only'
import { getTranslations } from 'next-intl/server'
import type { CompareLabels } from '../components/CompareSelection'
import type { SaveDeviceLabels } from '../components/SavedDevicesProvider'

export async function getSaveDeviceLabels(locale: string): Promise<SaveDeviceLabels> {
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.reference' })
  return { save: t('save'), saved: t('saved'), storage: t('storage'), limit: t('limit') }
}

export async function getCompareLabels(locale: string): Promise<CompareLabels> {
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.compareSelection' })
  return {
    add: t('add'),
    added: t('added'),
    limit: t('limit'),
    storage: t('storage'),
    trayHeading: t('trayHeading'),
    trayCompare: t('trayCompare'),
    trayNeedTwo: t('trayNeedTwo'),
    trayRemove: t('trayRemove'),
    trayClear: t('trayClear'),
    navCompare: t('navCompare'),
  }
}
