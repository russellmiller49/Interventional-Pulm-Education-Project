'use client'

import { useCallback, useEffect, useState } from 'react'
import { FlaskConical, ScanSearch } from 'lucide-react'

import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import type { SocratesSlideDocument } from '@/features/socrates-builder/types'

import { SocratesDemo } from './SocratesDemo'
import styles from './socrates-demo-workspace.module.css'

type WorkspaceView = 'demo' | 'builder'

interface SocratesDemoWorkspaceProps {
  publishedDocument: SocratesSlideDocument | null
  sandboxDocuments: SocratesSlideDocument[]
}

export function SocratesDemoWorkspace({
  publishedDocument,
  sandboxDocuments,
}: SocratesDemoWorkspaceProps) {
  const [view, setView] = useState<WorkspaceView>('demo')
  const [sandboxCatalog, setSandboxCatalog] = useState(sandboxDocuments)

  useEffect(() => {
    const syncFromHash = () => setView(window.location.hash === '#builder' ? 'builder' : 'demo')
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const chooseView = useCallback((nextView: WorkspaceView) => {
    setView(nextView)
    const nextHash = nextView === 'builder' ? '#builder' : ''
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${nextHash}`,
    )
  }, [])

  return (
    <div className={styles.workspaceShell}>
      <section className={styles.launcher} aria-labelledby="socrates-workspace-title">
        <div>
          <span className={styles.kicker}>Private-link company workspace</span>
          <div className={styles.workspaceTitle} id="socrates-workspace-title">
            SOCRATES interactive demo
          </div>
          <p>
            Explore the working viewer or build a disposable annotation draft from the same unlisted
            URL. No sign-in is required.
          </p>
        </div>
        <div className={styles.viewPicker} role="group" aria-label="Choose workspace">
          <button
            type="button"
            className={view === 'demo' ? styles.activeView : undefined}
            aria-pressed={view === 'demo'}
            onClick={() => chooseView('demo')}
          >
            <ScanSearch aria-hidden="true" />
            <span>
              <strong>View demo</strong>
              <small>Try pan, zoom, and nested zones</small>
            </span>
          </button>
          <button
            type="button"
            className={view === 'builder' ? styles.activeView : undefined}
            aria-pressed={view === 'builder'}
            onClick={() => chooseView('builder')}
          >
            <FlaskConical aria-hidden="true" />
            <span>
              <strong>Build a slide</strong>
              <small>{sandboxCatalog.length} shared sandbox drafts</small>
            </span>
          </button>
        </div>
      </section>

      {view === 'demo' ? (
        publishedDocument ? (
          <SocratesDemo
            key={publishedDocument.recordId ?? publishedDocument.slug}
            slide={publishedDocument.slide}
            annotations={publishedDocument.annotations}
          />
        ) : (
          <SocratesDemo />
        )
      ) : (
        <SocratesBuilder
          access={{ canPersist: true, canPublish: false, userEmail: null }}
          initialDocuments={sandboxCatalog}
          mode="sandbox"
          embedded
          onDocumentsChange={setSandboxCatalog}
        />
      )}
    </div>
  )
}
