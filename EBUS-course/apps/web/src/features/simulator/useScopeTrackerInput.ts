import { useEffect, useRef, useState, type MutableRefObject } from 'react';

import {
  GamepadScopeSource,
  ScopeDeltaTracker,
  loadActiveScopeTrackerProfile,
  startInputFrameLoop,
  subscribeToScopeTrackerProfileChanges,
  type ScopeFrameDeltas,
  type ScopeInputFrame,
} from '@/lib/scope-input';

export interface ScopeTrackerStatus {
  connected: boolean;
  deviceId: string | null;
  lowQuality: boolean;
}

export interface ScopeTrackerFrameHandlers {
  onFrame: (frame: ScopeInputFrame, deltas: ScopeFrameDeltas) => void;
  onDisconnect: () => void;
}

const IDLE_STATUS: ScopeTrackerStatus = { connected: false, deviceId: null, lowQuality: false };

/**
 * Polls the physical scope tracker (USB HID gamepad, see src/lib/scope-input/) once per
 * animation frame while enabled. Handlers are read through a ref the caller reassigns
 * every render, so they always close over fresh state.
 */
export function useScopeTrackerInput(
  enabled: boolean,
  handlersRef: MutableRefObject<ScopeTrackerFrameHandlers | null>,
): ScopeTrackerStatus {
  const [status, setStatus] = useState<ScopeTrackerStatus>(IDLE_STATUS);

  useEffect(() => {
    if (!enabled) {
      setStatus(IDLE_STATUS);
      return;
    }
    let profile = loadActiveScopeTrackerProfile();
    const source = new GamepadScopeSource({ profile });
    const tracker = new ScopeDeltaTracker();
    const unsubscribeProfiles = subscribeToScopeTrackerProfileChanges(() => {
      profile = loadActiveScopeTrackerProfile();
      source.setProfile(profile);
    });

    let wasConnected = false;
    let lastStatus = IDLE_STATUS;
    const tick = () => {
      const frame = source.sample();
      if (frame) {
        wasConnected = true;
        handlersRef.current?.onFrame(frame, tracker.update(frame, profile));
      } else if (wasConnected) {
        wasConnected = false;
        tracker.reset();
        handlersRef.current?.onDisconnect();
      }
      const nextStatus: ScopeTrackerStatus = {
        connected: source.connected,
        deviceId: source.deviceId,
        lowQuality: frame?.status.lowQuality ?? false,
      };
      if (
        nextStatus.connected !== lastStatus.connected ||
        nextStatus.deviceId !== lastStatus.deviceId ||
        nextStatus.lowQuality !== lastStatus.lowQuality
      ) {
        lastStatus = nextStatus;
        setStatus(nextStatus);
      }
    };
    const stopLoop = startInputFrameLoop(tick);
    return () => {
      stopLoop();
      unsubscribeProfiles();
      setStatus(IDLE_STATUS);
    };
  }, [enabled, handlersRef]);

  return status;
}
