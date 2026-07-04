'use client'

import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScopeTrackerSerialLink, isWebSerialSupported } from '@/lib/scope-input'
import type {
  ScopeTrackerCommand,
  ScopeTrackerDeviceMessage,
  ScopeTrackerHelloMessage,
  ScopeTrackerSerialStatus,
  ScopeTrackerStateMessage,
} from '@/lib/scope-input'

import { SectionCard } from './SectionCard'

const MAX_LOG_LINES = 14

function squalTone(squal: number | undefined): string {
  if (typeof squal !== 'number') return 'text-muted-foreground'
  if (squal >= 60) return 'text-emerald-600 dark:text-emerald-400'
  if (squal >= 40) return 'text-amber-700 dark:text-amber-300'
  return 'text-red-600 dark:text-red-400'
}

export function SerialDiagnostics() {
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<ScopeTrackerSerialStatus>('disconnected')
  const [statusDetail, setStatusDetail] = useState<string | null>(null)
  const [hello, setHello] = useState<ScopeTrackerHelloMessage | null>(null)
  const [lastState, setLastState] = useState<ScopeTrackerStateMessage | null>(null)
  const [log, setLog] = useState<string[]>([])
  const linkRef = useRef<ScopeTrackerSerialLink | null>(null)

  useEffect(() => {
    setSupported(isWebSerialSupported())
    return () => {
      void linkRef.current?.disconnect()
    }
  }, [])

  const appendLog = (line: string) => {
    setLog((current) => [...current.slice(-(MAX_LOG_LINES - 1)), line])
  }

  const handleMessage = (message: ScopeTrackerDeviceMessage) => {
    if (message.t === 'hello') setHello(message)
    if (message.t === 'state') setLastState(message)
  }

  const connect = async () => {
    if (linkRef.current) return
    const link = new ScopeTrackerSerialLink({
      onMessage: handleMessage,
      onRawLine: appendLog,
      onStatusChange: (nextStatus, detail) => {
        setStatus(nextStatus)
        setStatusDetail(detail ?? null)
        if (nextStatus === 'disconnected' || nextStatus === 'error') {
          linkRef.current = null
        }
      },
    })
    linkRef.current = link
    try {
      await link.connect()
      await link.send({ cmd: 'hello' })
      await link.send({ cmd: 'stream', on: true, hz: 20 })
    } catch {
      linkRef.current = null
    }
  }

  const disconnect = async () => {
    await linkRef.current?.disconnect()
    linkRef.current = null
  }

  const send = async (command: ScopeTrackerCommand) => {
    try {
      await linkRef.current?.send(command)
    } catch (error) {
      appendLog(`send failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const connected = status === 'connected'

  return (
    <SectionCard
      title="Serial diagnostics & device calibration"
      description="Optional Web Serial channel for SQUAL, raw optical counts, zeroing, and firmware-side calibration. Runtime input never needs this."
    >
      {!supported ? (
        <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
          Web Serial is not available in this browser. Use a Chromium-based desktop browser (Chrome
          or Edge) for calibration — runtime gamepad input works everywhere.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={connected ? 'success' : status === 'error' ? 'destructive' : 'outline'}>
              {status}
            </Badge>
            {statusDetail ? (
              <span className="text-xs text-muted-foreground">{statusDetail}</span>
            ) : null}
            {hello ? (
              <span className="text-xs text-muted-foreground">
                fw {hello.fw ?? '?'} · proto {hello.proto}
              </span>
            ) : null}
            <div className="ml-auto flex gap-2">
              {connected ? (
                <Button size="sm" variant="outline" onClick={() => void disconnect()}>
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" onClick={() => void connect()}>
                  Connect serial
                </Button>
              )}
            </div>
          </div>

          {connected ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    SQUAL
                  </div>
                  <div
                    className={`text-2xl font-semibold tabular-nums ${squalTone(lastState?.squal)}`}
                  >
                    {lastState?.squal ?? '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Depth (raw)
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {lastState?.depth_mm?.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Roll (raw °)
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {lastState?.roll_deg?.toFixed(0) ?? '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Wiper sessions
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-foreground">
                    {lastState?.wiper ?? '—'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void send({ cmd: 'zero', what: 'depth' })}
                >
                  Zero depth
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void send({ cmd: 'zero', what: 'roll' })}
                >
                  Zero roll
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void send({ cmd: 'zero', what: 'all' })}
                >
                  Zero all
                </Button>
                <Button size="sm" variant="outline" onClick={() => void send({ cmd: 'get_cfg' })}>
                  Read config
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void send({ cmd: 'wiper_reset' })}
                >
                  Wiper replaced
                </Button>
              </div>
            </>
          ) : null}

          {log.length > 0 ? (
            <pre className="max-h-48 overflow-auto rounded-xl border border-border/70 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
              {log.join('\n')}
            </pre>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}
