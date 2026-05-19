import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function EducationChestDrainageReferencesRedirectPage() {
  redirect('/pleural-procedures/chest-drainage/references' as Route)
}
