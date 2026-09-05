import { useEffect, useRef } from 'react'

import type { EcmoSimulationState } from '../engine/types'

/**
 * One short tone per newly active alarm, pitched by priority, when the learner has enabled alarm
 * audio on the console. Audio is optional throughout: the visual and text alarm communication is
 * complete without it, so every failure path is silent.
 */
export function useAlarmAudio(
  state: Pick<EcmoSimulationState, 'alarms' | 'device' | 'simulationTime'>,
): void {
  const lastAudibleAlarmId = useRef<string | null>(null)

  useEffect(() => {
    const alarm =
      state.alarms.find((candidate) => candidate.acknowledgedAt === undefined) ?? state.alarms[0]
    const acknowledgedPauseActive =
      alarm?.acknowledgedAt !== undefined &&
      (state.device.alarmPausedUntil ?? 0) > state.simulationTime
    if (acknowledgedPauseActive) {
      lastAudibleAlarmId.current = null
      return
    }
    if (!state.device.alarmAudioEnabled || !alarm || alarm.id === lastAudibleAlarmId.current) {
      return
    }
    lastAudibleAlarmId.current = alarm.id
    try {
      const AudioContextClass = window.AudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value =
        alarm.priority === 'high' ? 880 : alarm.priority === 'medium' ? 660 : 520
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.18)
      oscillator.addEventListener('ended', () => void context.close(), { once: true })
    } catch {
      // Audio is optional; visual and text alarm communication remains complete.
    }
  }, [
    state.alarms,
    state.device.alarmAudioEnabled,
    state.device.alarmPausedUntil,
    state.simulationTime,
  ])
}
