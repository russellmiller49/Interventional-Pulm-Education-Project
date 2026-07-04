'use client'

import { ScopeInputProvider } from '@/lib/scope-input'

import { EmulatorPanel } from './EmulatorPanel'
import { LiveMonitor } from './LiveMonitor'
import { ProfileEditor } from './ProfileEditor'
import { SerialDiagnostics } from './SerialDiagnostics'

export function HardwareSetupShell() {
  return (
    <ScopeInputProvider>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <LiveMonitor />
          <EmulatorPanel />
        </div>
        <div className="space-y-6">
          <ProfileEditor />
          <SerialDiagnostics />
        </div>
      </div>
    </ScopeInputProvider>
  )
}
