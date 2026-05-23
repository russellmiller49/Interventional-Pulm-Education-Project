import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function EducationChestDrainageSimulatorsRedirectPage() {
  redirect('/pleural-procedures/chest-drainage/simulators' as Route)
}
