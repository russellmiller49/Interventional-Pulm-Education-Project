import { SimulatorPage as SimulatorModulePage } from '@/features/simulator/SimulatorPage';

export function SimulatorPage({ showVirtualBronchoscopy = false }: { showVirtualBronchoscopy?: boolean }) {
  return <SimulatorModulePage showVirtualBronchoscopy={showVirtualBronchoscopy} />;
}
