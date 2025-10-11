import type { Preview } from '@storybook/react'
import { useEffect } from 'react'

import { ThemeProvider } from '@/components/layout/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'surface',
      values: [
        { name: 'surface', value: 'hsl(0, 0%, 100%)' },
        { name: 'subtle', value: 'hsl(210, 40%, 96%)' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => {
      // Ensure prefers-reduced-motion is respected in Storybook environment
      useEffect(() => {
        document.documentElement.classList.add('motion-safe')
      }, [])

      return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="min-h-screen bg-background text-foreground antialiased">
            <div className="p-8">
              <Story />
            </div>
          </div>
          <Toaster />
        </ThemeProvider>
      )
    },
  ],
}

export default preview
