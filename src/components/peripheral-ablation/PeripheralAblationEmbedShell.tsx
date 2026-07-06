'use client'

export const peripheralAblationModulePath = '/peripheral-ablation/index.html'

export function PeripheralAblationEmbedShell() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={peripheralAblationModulePath}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Open dedicated view ↗
        </a>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-sm">
        <iframe
          title="Peripheral Lung Tumor Ablation Interactive Module"
          src={peripheralAblationModulePath}
          className="h-[calc(100vh-9rem)] min-h-[820px] w-full bg-white"
          // Browser extensions (e.g. Ruffle) stamp attributes on iframes before hydration.
          suppressHydrationWarning
        />
      </div>
    </div>
  )
}
