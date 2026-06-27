import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function EducationChestDrainageAssessmentRedirectPage() {
  redirect('/pleural-procedures/chest-drainage/assessment' as Route)
}
