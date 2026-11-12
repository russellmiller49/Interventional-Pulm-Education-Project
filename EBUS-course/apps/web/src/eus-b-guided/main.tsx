import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  isEusbConfig,
  isEusbMessage,
  type EusbObservation,
  type EusbWorkbenchConfig,
} from '../../../../../src/lib/eus-b-guided-bridge';
import {
  EUSB_CONTRACT_REVISION,
  isEusbLabId,
} from '../../../../../src/lib/eus-b-guided-contract';
import { EusGuidedWorkbench } from './EusGuidedWorkbench';

/**
 * Entry of the EUS-B guided lab. It is shown inside a lesson page, which tells it which lab to
 * run and is told what the learner did. It has no course shell, account or progress of its own.
 */
const framed = window.parent !== window;
/**
 * From this size up the lab fills its frame in one row and never scrolls (see the stylesheet), so
 * its height is the frame's own and is not reported: reporting it would only echo the frame back.
 */
const ONE_SCREEN = '(min-width: 700px) and (min-height: 480px)';

function send(message: object) {
  if (!framed) return;
  window.parent.postMessage({ version: 1, ...message }, window.location.origin);
}

/**
 * Opened on its own, with no lesson page around it, the lab reads which lab to run from the
 * address: `#lab=<id>&phase=work|review&names=hidden|shown`. This is for development and browser
 * checks. Inside a lesson page the address is never read.
 */
function configFromHash(): EusbWorkbenchConfig | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const labId = params.get('lab');
  if (!isEusbLabId(labId)) return null;
  const config = {
    sessionId: 'standalone',
    labId,
    phase: params.get('phase') === 'review' ? 'review' : 'work',
    names: params.get('names') === 'shown' ? 'shown' : 'hidden',
    // The white light view is on in a task, as it is in a lesson.
    panes: params.get('phase') === 'review' ? ['ultrasound'] : ['ultrasound', 'endoscope'],
    observationRequest: 0,
  };
  return isEusbConfig(config) ? config : null;
}

class WorkbenchBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError('The lab could not be drawn. Reload the activity to retry.');
  }
  render() {
    return this.state.failed ? (
      <p role="alert" style={{ padding: 24 }}>
        The lab could not be drawn. Return to the lesson and retry.
      </p>
    ) : (
      this.props.children
    );
  }
}

function GuidedApp() {
  const [config, setConfig] = useState<EusbWorkbenchConfig | null>(() =>
    framed ? null : configFromHash(),
  );
  const latest = useRef(config);
  latest.current = config;

  useEffect(() => {
    if (!framed) {
      const onHash = () => setConfig(configFromHash());
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        !isEusbMessage(event.data) ||
        event.data.type !== 'configure'
      )
        return;
      setConfig(event.data.config);
    };
    window.addEventListener('message', receive);
    send({ type: 'ready', contractRevision: EUSB_CONTRACT_REVISION });
    return () => window.removeEventListener('message', receive);
  }, []);

  const sessionId = config?.sessionId;
  useEffect(() => {
    if (!sessionId || !framed) return;
    const root = document.getElementById('root')!;
    let pending: ReturnType<typeof setTimeout> | null = null;
    // A timer, not an animation frame: the page may be in a hidden tab.
    const resize = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        // Hidden by the lesson page, or filling its frame: there is no height of its own to give.
        const height = root.getBoundingClientRect().height;
        if (height <= 0 || window.matchMedia(ONE_SCREEN).matches) return;
        send({
          type: 'resize',
          sessionId,
          height: Math.max(200, Math.min(10000, Math.ceil(root.getBoundingClientRect().height) + 4)),
        });
      }, 50);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    const layout = window.matchMedia(ONE_SCREEN);
    layout.addEventListener('change', resize);
    resize();
    return () => {
      observer.disconnect();
      layout.removeEventListener('change', resize);
      if (pending) clearTimeout(pending);
    };
  }, [sessionId]);

  const onObservation = useCallback((observation: EusbObservation) => {
    const current = latest.current;
    if (!current) return;
    send({
      type: 'observation',
      sessionId: current.sessionId,
      observationRequest: current.observationRequest,
      observation,
    });
  }, []);
  const onError = useCallback((message: string) => {
    send({ type: 'error', sessionId: latest.current?.sessionId ?? 'unconfigured', message });
  }, []);

  if (!config)
    return (
      <p role="status" style={{ padding: 24 }}>
        {framed ? 'Waiting for the lesson…' : 'Open this lab from its lesson.'}
      </p>
    );
  // Not keyed by session: a new lab is set up in place, so the image worker is started once.
  return (
    <WorkbenchBoundary onError={onError}>
      <EusGuidedWorkbench config={config} onObservation={onObservation} onError={onError} />
    </WorkbenchBoundary>
  );
}

createRoot(document.getElementById('root')!).render(<GuidedApp />);
