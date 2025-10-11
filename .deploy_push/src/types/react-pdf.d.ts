declare module '@react-pdf/renderer' {
  import type { ReactNode } from 'react'

  export interface PDFInstance {
    toBlob(): Promise<Blob>
  }

  export const Document: React.ComponentType<{ children?: ReactNode }>
  export const Page: React.ComponentType<{ children?: ReactNode; size?: string; style?: unknown }>
  export const Text: React.ComponentType<{ children?: ReactNode; style?: unknown }>
  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T
  }
  export function pdf(element: ReactNode): PDFInstance
}
