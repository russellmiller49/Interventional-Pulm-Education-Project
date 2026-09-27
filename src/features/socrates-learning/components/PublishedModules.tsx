'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'
import { SocratesLearningWorkspace } from './SocratesLearningWorkspace'
export function PublishedModules(props: ComponentProps<typeof SocratesLearningWorkspace>) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [router])
  return <SocratesLearningWorkspace {...props} published />
}
