'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface ChecklistButtonProps {
  moduleTitle: string
  items: string[]
}

export function ChecklistButton({ moduleTitle, items }: ChecklistButtonProps) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    try {
      setError(null)
      setDownloading(true)
      const [{ Document, Page, Text, StyleSheet, pdf }] = await Promise.all([
        import('@react-pdf/renderer'),
      ])

      const styles = StyleSheet.create({
        page: { padding: 32, fontSize: 12, fontFamily: 'Helvetica' },
        heading: { fontSize: 18, marginBottom: 16 },
        item: { marginBottom: 8 },
      })

      const ChecklistDocument = (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.heading}>{moduleTitle} · Checklist</Text>
            {items.map((item) => (
              <Text key={item} style={styles.item}>
                □ {item}
              </Text>
            ))}
          </Page>
        </Document>
      )

      const blob = await pdf(ChecklistDocument).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${moduleTitle.replace(/\s+/g, '-')}-checklist.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      setError('Unable to generate PDF in this environment. Please try again later.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleGenerate} disabled={!items.length || downloading} variant="outline">
        {downloading ? 'Generating…' : 'Download checklist (PDF)'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
