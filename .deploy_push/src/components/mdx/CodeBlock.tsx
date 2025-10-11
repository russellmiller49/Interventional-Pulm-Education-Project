import { Button } from '@/components/ui/button'

interface CodeBlockProps {
  language?: string
  children: string
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const code = children.trim()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch (error) {
      console.warn('Unable to copy code block', error)
    }
  }

  return (
    <div className="not-prose group relative my-6 overflow-hidden rounded-2xl border border-border/60 bg-background/80">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        <span>{language ?? 'code'}</span>
        <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={handleCopy}>
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-sm text-muted-foreground">
        <code>{code}</code>
      </pre>
    </div>
  )
}
