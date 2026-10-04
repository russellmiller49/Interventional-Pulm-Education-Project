import { simulatorPage } from '@/components/layout/simulator-page'

export const thermalAblationModulePath = '/thermal-ablation/index.html'

export function ThermalAblationEmbedShell() {
  return (
    <div className={simulatorPage.frame}>
      <iframe
        title="Thermal &amp; Electrosurgical Ablation Interactive Module"
        src={thermalAblationModulePath}
        className={`${simulatorPage.iframe} bg-white`}
        // Browser extensions (e.g. Ruffle) stamp attributes on iframes before hydration.
        suppressHydrationWarning
      />
    </div>
  )
}
