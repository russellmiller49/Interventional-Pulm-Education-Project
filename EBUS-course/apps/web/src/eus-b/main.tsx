import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { EusBSimulatorPage } from '@/features/eus-b-simulator/EusBSimulatorPage';

/** Standalone entry: the simulator has no course shell, account or progress dependencies. */
class SimulatorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" style={{ padding: 24 }}>
        The EUS-B simulator could not render. Reload the page to retry.
      </p>
    ) : (
      this.props.children
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <SimulatorBoundary>
    <EusBSimulatorPage />
  </SimulatorBoundary>,
);
