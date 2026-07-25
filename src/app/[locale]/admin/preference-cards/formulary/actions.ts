'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getPreferenceCardSession } from '@/features/preference-cards/server/access'

const mappingSchema = z.object({
  locale: z.string().min(2).max(16),
  roleCode: z.string().regex(/^[A-Z0-9_]{1,100}$/),
  catalogProductId: z.string().max(100),
  localDescription: z.string().trim().min(1).max(240),
  localItemNumber: z.string().trim().max(120),
  localUom: z.string().trim().max(80),
  storageLocation: z.string().trim().max(160),
  substitutionClass: z.enum([
    'preferred',
    'acceptable',
    'shortage_substitute',
    'backup',
    'emergency_only',
    'no_substitute',
  ]),
})

function value(formData: FormData, key: string): string {
  const candidate = formData.get(key)
  return typeof candidate === 'string' ? candidate : ''
}

export async function saveHospitalMappingAction(formData: FormData): Promise<void> {
  const parsed = mappingSchema.safeParse({
    locale: value(formData, 'locale'),
    roleCode: value(formData, 'roleCode'),
    catalogProductId: value(formData, 'catalogProductId'),
    localDescription: value(formData, 'localDescription'),
    localItemNumber: value(formData, 'localItemNumber'),
    localUom: value(formData, 'localUom'),
    storageLocation: value(formData, 'storageLocation'),
    substitutionClass: value(formData, 'substitutionClass'),
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'The hospital mapping is invalid.')
  }

  const session = await getPreferenceCardSession()
  if (!session.user || !session.canAdmin) {
    throw new Error('Site administrator or preference-card content-owner access is required.')
  }

  const membership = session.memberships.find(
    (candidate) => candidate.role === 'admin' || candidate.role === 'content_owner',
  )
  const organizationId = membership?.organization_id ?? '00000000-0000-4000-8000-000000000101'
  const { data: site } = await session.supabase
    .from('ip_sites')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const { data: location } = site
    ? await session.supabase
        .from('ip_procedure_locations')
        .select('id')
        .eq('site_id', site.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  if (!site || !location) {
    throw new Error('Create an organization site and procedure location before saving a mapping.')
  }

  const catalogProductId = parsed.data.catalogProductId || null
  const { data: catalogProduct } = catalogProductId
    ? await session.supabase
        .from('ip_catalog_products')
        .select('catalog_import_id')
        .eq('product_id', catalogProductId)
        .order('catalog_import_id', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }
  if (catalogProductId && !catalogProduct) {
    throw new Error(
      'Import the normalized catalog into the migrated database before mapping this commercial product.',
    )
  }
  const { error: mappingError } = await session.supabase.rpc('ip_save_hospital_mapping', {
    payload: {
      organization_id: organizationId,
      site_id: site.id,
      location_id: location.id,
      item_type: catalogProductId ? 'commercial_product' : 'hospital_local_disposable',
      catalog_import_id: catalogProduct?.catalog_import_id ?? null,
      catalog_product_id: catalogProductId,
      role_code: parsed.data.roleCode,
      local_item_number: parsed.data.localItemNumber || null,
      local_description: parsed.data.localDescription,
      local_uom: parsed.data.localUom || null,
      storage_location: parsed.data.storageLocation || null,
      verification_state: 'unverified',
      notes:
        'Created through the protected v0.1 formulary mapping prototype; verification remains required.',
      substitution_class: parsed.data.substitutionClass,
      preference_rank: 1,
      rationale: 'Administrator-authored local mapping; current review required.',
    },
  })
  if (mappingError) throw new Error(mappingError.message)

  revalidatePath(`/${parsed.data.locale}/admin/preference-cards/formulary`)
}
