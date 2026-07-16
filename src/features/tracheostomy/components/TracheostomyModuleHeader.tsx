import { ModuleHeader } from '@/features/learning-module/components/ModuleHeader'

import { TracheostomyDisclaimer } from './TracheostomyDisclaimer'

interface TracheostomyModuleHeaderProps {
  title: string
  description: string
}

export function TracheostomyModuleHeader({ title, description }: TracheostomyModuleHeaderProps) {
  return (
    <div className="space-y-5">
      <ModuleHeader
        eyebrow="Tracheostomy knowledge lab"
        title={title}
        description={description}
        showDisclaimer={false}
      />
      <div className="container">
        <TracheostomyDisclaimer />
      </div>
    </div>
  )
}
