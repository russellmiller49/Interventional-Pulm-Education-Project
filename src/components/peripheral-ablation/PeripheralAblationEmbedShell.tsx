import { simulatorPage } from '@/components/layout/simulator-page'

export const peripheralAblationModulePath = '/peripheral-ablation/index.html'

export function PeripheralAblationEmbedShell() {
  return (
    <div className={simulatorPage.frame}>
      <iframe
        title="Peripheral Lung Tumor Ablation Interactive Module"
        src={peripheralAblationModulePath}
        className={`${simulatorPage.iframe} bg-white`}
        // Browser extensions (e.g. Ruffle) stamp attributes on iframes before hydration.
        suppressHydrationWarning
      />
    </div>
  )
}
