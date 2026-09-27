'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FlaskConical, ScanSearch } from 'lucide-react'
import { SocratesLearningWorkspace } from '@/features/socrates-learning/components/SocratesLearningWorkspace'

import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import {
  readWebOverlayWorkspace,
  saveWebOverlayWorkspace,
  type WebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'

import { SocratesDemo } from './SocratesDemo'
import styles from './socrates-demo-workspace.module.css'

type WorkspaceView = 'demo' | 'builder' | 'learn'

export function SocratesDemoWorkspace() {
  const [view, setView] = useState<WorkspaceView>('demo')
  const [workspace, setWorkspace] = useState<WebOverlayWorkspace | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  useEffect(() => {
    const restored = readWebOverlayWorkspace()
    // Browser storage must be restored after hydration, before mounting a slide viewer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWorkspace(restored.workspace)
    setStorageWarning(restored.warning)
    const syncFromHash = () =>
      setView(
        window.location.hash === '#builder'
          ? 'builder'
          : window.location.hash === '#learn'
            ? 'learn'
            : 'demo',
      )
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const updateWorkspace = useCallback((next: WebOverlayWorkspace) => {
    // Retain in-memory edits even when browser storage is full or unavailable.
    setWorkspace(next)
    const warning = saveWebOverlayWorkspace(next)
    setStorageWarning(warning)
    return warning
  }, [])

  const chooseView = useCallback((nextView: WorkspaceView) => {
    setView(nextView)
    const nextHash = nextView === 'demo' ? '' : `#${nextView}`
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${nextHash}`,
    )
  }, [])

  // Restore the selected web slide before mounting either viewer. This also prevents
  // an old sample from flashing during hydration of a direct #builder link.
  if (!workspace) {
    return (
      <div className={styles.workspaceShell} role="status">
        Opening your Invenio overlay workspace…
      </div>
    )
  }

  return (
    <div className={styles.workspaceShell}>
      <section className={styles.launcher} aria-labelledby="socrates-workspace-title">
        <div>
          <span className={styles.kicker}>Invenio + SOCRATES</span>
          <div className={styles.workspaceTitle} id="socrates-workspace-title">
            SOCRATES slide workspace
          </div>
          <p>
            Review teaching and testing modules, explore slides, or prepare annotations. Drafts and
            review progress stay in this browser.
          </p>
        </div>
        <div className={styles.viewPicker} role="group" aria-label="Choose workspace">
          <button
            type="button"
            className={view === 'learn' ? styles.activeView : undefined}
            aria-pressed={view === 'learn'}
            onClick={() => chooseView('learn')}
          >
            <BookOpen aria-hidden="true" />
            <span>
              <strong>Teaching & testing</strong>
              <small>Separate learning modules</small>
            </span>
          </button>
          <button
            type="button"
            className={view === 'demo' ? styles.activeView : undefined}
            aria-pressed={view === 'demo'}
            onClick={() => chooseView('demo')}
          >
            <ScanSearch aria-hidden="true" />
            <span>
              <strong>View demo</strong>
              <small>Explore the current slide and its details</small>
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
              <small>
                {workspace.documents.length} browser{' '}
                {workspace.documents.length === 1 ? 'draft' : 'drafts'}
              </small>
            </span>
          </button>
        </div>
      </section>

      {storageWarning ? (
        <p className={styles.storageWarning} role="alert">
          {storageWarning}
        </p>
      ) : null}

      {view === 'learn' ? (
        <SocratesLearningWorkspace documents={workspace.documents} />
      ) : view === 'demo' ? (
        <SocratesDemo
          key={workspace.activeDocument.recordId ?? workspace.activeDocument.slug}
          slide={workspace.activeDocument.slide}
          annotations={workspace.activeDocument.annotations}
        />
      ) : (
        <SocratesBuilder
          access={{ canPersist: false, canPublish: false, userEmail: null }}
          initialDocuments={workspace.documents}
          initialActiveDocument={workspace.activeDocument}
          initialStorageError={storageWarning}
          mode="local"
          embedded
          onLocalWorkspaceChange={updateWorkspace}
        />
      )}
    </div>
  )
}
