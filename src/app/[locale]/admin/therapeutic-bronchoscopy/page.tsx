import { Suspense } from 'react'
import { TherapeuticBronchoscopyModule } from '@/features/therapeutic-bronchoscopy/TherapeuticBronchoscopyModule'
export const metadata = {
  title: 'Therapeutic Bronchoscopy Simulator',
  robots: { index: false, follow: false },
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading therapeutic bronchoscopy…</p>}>
      <TherapeuticBronchoscopyModule />
    </Suspense>
  )
}
