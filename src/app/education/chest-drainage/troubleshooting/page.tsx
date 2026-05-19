import type { Route } from 'next'
import { redirect } from 'next/navigation'

export default function EducationChestDrainageTroubleshootingRedirectPage() {
  redirect('/pleural-procedures/chest-drainage/troubleshooting' as Route)
}
