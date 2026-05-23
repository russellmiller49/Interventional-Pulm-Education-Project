import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function EducationChestDrainageLearnRedirectPage() {
  redirect('/pleural-procedures/chest-drainage/learn' as Route)
}
