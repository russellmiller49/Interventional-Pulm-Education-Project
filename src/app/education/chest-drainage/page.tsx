import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function EducationChestDrainageRedirectPage() {
  redirect('/pleural-procedures/chest-drainage' as Route)
}
