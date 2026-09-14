import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { LocaleProvider } from '@/i18n/locale'
import { SimulatorWorkbench } from '@/features/simulator/SimulatorPage'
import { ModelWorkbench } from './models/ModelWorkbench'
import { GuidedKnobology } from './GuidedKnobology'
import {
  isEbusMessage,
  type EbusObservation,
  type EbusWorkbenchConfig,
} from '../../../../../src/lib/ebus-guided-bridge'
import './guided.css'

function send(message: object) {
  window.parent.postMessage({ version: 1, ...message }, window.location.origin)
}
class WorkbenchBoundary extends Component<
  { children: ReactNode; sessionId: string },
  { error: boolean }
> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch() {
    send({
      type: 'error',
      sessionId: this.props.sessionId,
      message: 'The workbench could not render. Reload the activity to retry.',
    })
  }
  render() {
    return this.state.error ? (
      <p role="alert">The workbench could not render. Return to the lesson and retry.</p>
    ) : (
      this.props.children
    )
  }
}
function GuidedApp() {
  const [config, setConfig] = useState<EbusWorkbenchConfig | null>(null)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        !isEbusMessage(event.data) ||
        event.data.type !== 'configure'
      )
        return
      setConfig(event.data.config)
    }
    window.addEventListener('message', receive)
    send({ type: 'ready' })
    return () => window.removeEventListener('message', receive)
  }, [])
  const sessionId = config?.sessionId
  const onObservation = useCallback(
    (observation: EbusObservation) => {
      if (sessionId) send({ type: 'observation', sessionId, observation })
    },
    [sessionId],
  )
  if (!config) return <p role="status">Waiting for the guided lesson…</p>
  return (
    <WorkbenchBoundary key={config.sessionId} sessionId={config.sessionId}>
      {config.kind === 'model' ? (
        <ModelWorkbench config={config} onObservation={onObservation} />
      ) : config.kind === 'simulator' ? (
        <SimulatorWorkbench showVirtualBronchoscopy guided={{ config, onObservation }} />
      ) : (
        <GuidedKnobology config={config} onObservation={onObservation} />
      )}
    </WorkbenchBoundary>
  )
}
createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <LocaleProvider>
      <GuidedApp />
    </LocaleProvider>
  </HashRouter>,
)
