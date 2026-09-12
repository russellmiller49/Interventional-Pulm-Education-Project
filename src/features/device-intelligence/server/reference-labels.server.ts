import 'server-only'
import { getTranslations } from 'next-intl/server'
import type { SaveDeviceLabels } from '../components/SavedDevicesProvider'

export async function getSaveDeviceLabels(locale: string): Promise<SaveDeviceLabels> {
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.reference' })
  return { save: t('save'), saved: t('saved'), storage: t('storage'), limit: t('limit') }
}
