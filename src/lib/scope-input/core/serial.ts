/**
 * Web Serial (USB CDC) calibration/diagnostics channel.
 * Protocol: newline-delimited JSON, contract §4. Runtime input never depends on this —
 * it exists for the /hardware setup page (SQUAL, raw counts, zeroing, guided calibration).
 */

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

export interface ScopeTrackerHelloMessage {
  t: 'hello'
  proto: number
  fw?: string
  dev?: string
  hw?: string
}

export interface ScopeTrackerStateMessage {
  t: 'state'
  ms?: number
  depth_mm?: number
  /** Raw accumulated (unbounded) roll for debugging. */
  roll_deg?: number
  flex?: number
  lever_deg?: number
  squal?: number
  dx?: number
  dy?: number
  gate?: number
  btn?: number
  wiper?: number
  fault?: number
}

export interface ScopeTrackerAckMessage {
  t: 'ack'
  cmd?: string
  ok?: boolean
}

export interface ScopeTrackerErrMessage {
  t: 'err'
  cmd?: string
  msg?: string
}

export interface ScopeTrackerCfgMessage {
  t: 'cfg'
  matrix?: number[]
  lever?: { min?: number; neutral?: number; max?: number }
  squal_min?: number
  wiper_limit?: number
  wiper?: number
}

export interface ScopeTrackerCalMessage {
  t: 'cal'
  maneuver?: string
  phase?: string
  samples?: number
  result?: Record<string, number>
}

export type ScopeTrackerDeviceMessage =
  | ScopeTrackerHelloMessage
  | ScopeTrackerStateMessage
  | ScopeTrackerAckMessage
  | ScopeTrackerErrMessage
  | ScopeTrackerCfgMessage
  | ScopeTrackerCalMessage

export type ScopeTrackerCalManeuver = 'depth_100mm' | 'roll_360' | 'helical' | 'lever'

export type ScopeTrackerCommand =
  | { cmd: 'hello' }
  | { cmd: 'stream'; on: boolean; hz?: number }
  | { cmd: 'zero'; what: 'depth' | 'roll' | 'all' }
  | { cmd: 'get_cfg' }
  | {
      cmd: 'set_cfg'
      matrix?: [number, number, number, number]
      lever?: { min: number; neutral: number; max: number }
      squal_min?: number
    }
  | { cmd: 'save_cfg' }
  | { cmd: 'cal'; maneuver: ScopeTrackerCalManeuver }
  | { cmd: 'cal_abort' }
  | { cmd: 'wiper_reset' }

export function encodeScopeTrackerCommand(command: ScopeTrackerCommand): string {
  return `${JSON.stringify(command)}\n`
}

const KNOWN_MESSAGE_TYPES = new Set(['hello', 'state', 'ack', 'err', 'cfg', 'cal'])

/** Parse one line into a device message. Returns null for garbage/unknown types. */
export function parseScopeTrackerMessage(line: string): ScopeTrackerDeviceMessage | null {
  try {
    const value: unknown = JSON.parse(line)
    if (value && typeof value === 'object') {
      const type = (value as { t?: unknown }).t
      if (typeof type === 'string' && KNOWN_MESSAGE_TYPES.has(type)) {
        return value as ScopeTrackerDeviceMessage
      }
    }
  } catch {
    // fall through
  }
  return null
}

/** Reassembles newline-delimited frames from arbitrary text chunks. */
export class LineSplitter {
  private buffer = ''

  push(chunk: string): string[] {
    this.buffer += chunk
    const parts = this.buffer.split(/\r?\n/)
    this.buffer = parts.pop() ?? ''
    const lines: string[] = []
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.length > 0) lines.push(trimmed)
    }
    return lines
  }

  /** Return and clear any trailing partial line (e.g. at disconnect). */
  flush(): string | null {
    const trimmed = this.buffer.trim()
    this.buffer = ''
    return trimmed.length > 0 ? trimmed : null
  }
}

// ---------------------------------------------------------------------------
// Web Serial link (browser only; structural types so no global lib deps)
// ---------------------------------------------------------------------------

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}

interface SerialLike {
  requestPort(options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
  }): Promise<SerialPortLike>
}

function getWebSerial(): SerialLike | null {
  if (typeof navigator === 'undefined') return null
  const serial = (navigator as unknown as { serial?: SerialLike }).serial
  return serial ?? null
}

export function isWebSerialSupported(): boolean {
  return getWebSerial() !== null
}

export type ScopeTrackerSerialStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ScopeTrackerSerialLinkEvents {
  onMessage?: (message: ScopeTrackerDeviceMessage) => void
  onRawLine?: (line: string) => void
  onStatusChange?: (status: ScopeTrackerSerialStatus, detail?: string) => void
}

const RASPBERRY_PI_USB_VENDOR_ID = 0x2e8a

/**
 * Thin Web Serial client for the calibration channel. connect() must be called from a
 * user gesture (browser requirement for requestPort).
 */
export class ScopeTrackerSerialLink {
  private readonly events: ScopeTrackerSerialLinkEvents
  private port: SerialPortLike | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private currentStatus: ScopeTrackerSerialStatus = 'disconnected'
  private closing = false

  constructor(events: ScopeTrackerSerialLinkEvents = {}) {
    this.events = events
  }

  get status(): ScopeTrackerSerialStatus {
    return this.currentStatus
  }

  private setStatus(status: ScopeTrackerSerialStatus, detail?: string): void {
    this.currentStatus = status
    this.events.onStatusChange?.(status, detail)
  }

  async connect(): Promise<void> {
    const serial = getWebSerial()
    if (!serial) {
      this.setStatus('error', 'Web Serial is not supported in this browser')
      throw new Error('Web Serial not supported')
    }
    if (this.port) return
    this.setStatus('connecting')
    try {
      // Vendor filter keeps the picker focused on RP2040 boards; custom boards can
      // still be selected because we also pass an unfiltered entry.
      const port = await serial.requestPort({
        filters: [{ usbVendorId: RASPBERRY_PI_USB_VENDOR_ID }],
      })
      await port.open({ baudRate: 115200 })
      this.port = port
      this.closing = false
      if (port.writable) this.writer = port.writable.getWriter()
      this.setStatus('connected')
      void this.readLoop()
    } catch (error) {
      this.port = null
      this.writer = null
      const detail = error instanceof Error ? error.message : String(error)
      this.setStatus(detail.includes('No port selected') ? 'disconnected' : 'error', detail)
      throw error
    }
  }

  private async readLoop(): Promise<void> {
    const splitter = new LineSplitter()
    const decoder = new TextDecoder()
    while (this.port?.readable && !this.closing) {
      this.reader = this.port.readable.getReader()
      try {
        for (;;) {
          const { value, done } = await this.reader.read()
          if (done) break
          if (!value) continue
          for (const line of splitter.push(decoder.decode(value, { stream: true }))) {
            this.events.onRawLine?.(line)
            const message = parseScopeTrackerMessage(line)
            if (message) this.events.onMessage?.(message)
          }
        }
      } catch (error) {
        if (!this.closing) {
          const detail = error instanceof Error ? error.message : String(error)
          this.setStatus('error', detail)
        }
        break
      } finally {
        this.reader.releaseLock()
        this.reader = null
      }
    }
    if (!this.closing) {
      await this.disconnect().catch(() => {})
    }
  }

  async send(command: ScopeTrackerCommand): Promise<void> {
    if (!this.writer) throw new Error('Serial link is not connected')
    const encoded = new TextEncoder().encode(encodeScopeTrackerCommand(command))
    await this.writer.write(encoded)
  }

  async disconnect(): Promise<void> {
    this.closing = true
    try {
      await this.reader?.cancel()
    } catch {
      // reader may already be done
    }
    try {
      this.writer?.releaseLock()
    } catch {
      // writer may already be released
    }
    this.writer = null
    try {
      await this.port?.close()
    } catch {
      // port may already be closed/unplugged
    }
    this.port = null
    this.setStatus('disconnected')
  }
}
