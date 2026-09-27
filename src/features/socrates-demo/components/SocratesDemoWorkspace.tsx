'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { BookOpen, FlaskConical, ScanSearch } from 'lucide-react'
import { SocratesLearningWorkspace } from '@/features/socrates-learning/components/SocratesLearningWorkspace'

import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import {
  readWebOverlayWorkspace,
  saveWebOverlayWorkspace,
  type WebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'

import {
  SlideLibrary,
  AssignmentSelect,
} from '@/features/socrates-learning/components/SlideLibrary'
import {
  documentKey,
  emptyCurriculum,
  mergeCurriculum,
  normalizeWorkspace,
} from '@/features/socrates-learning/author-library'
import {
  COLLECTION_KEY,
  collectionSchema,
  PROGRESS_KEY,
  progressSchema,
  type LearningMode,
} from '@/features/socrates-learning/model'
import { upgradeSocratesDocument } from '@/features/socrates-builder/schema'
import { createBlankSocratesDocument } from '@/features/socrates-builder/content/starter-document'
import { createInvenioDemoDocument } from '@/features/socrates-builder/content/invenio-demo-document'
import type { SocratesSlideDocument } from '@/features/socrates-builder/types'
import type { SlideAssignment } from '@/features/socrates-builder/web-overlay-storage'
import libraryStyles from '@/features/socrates-learning/components/library.module.css'
import { SocratesDemo } from './SocratesDemo'
import styles from './socrates-demo-workspace.module.css'

type WorkspaceView = 'demo' | 'builder' | 'learn' | 'library'

export function SocratesDemoWorkspace() {
  const locale = useLocale()
  const [view, setView] = useState<WorkspaceView>('demo')
  const [workspace, setWorkspace] = useState<WebOverlayWorkspace | null>(null)
  const workspaceRef = useRef<WebOverlayWorkspace | null>(null)
  const [preview, setPreview] = useState<{ id: string; mode: LearningMode } | undefined>()
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  useEffect(() => {
    const restored = readWebOverlayWorkspace()
    // Browser storage must be restored after hydration, before mounting a slide viewer.
    let next = normalizeWorkspace(restored.workspace)
    let warning = restored.warning
    if (!next.curriculum && !warning) {
      try {
        const raw = localStorage.getItem(COLLECTION_KEY)
        if (raw) {
          const collection = collectionSchema.parse(JSON.parse(raw))
          next = mergeCurriculum(next, collection)
          // Carry valid review progress across the introduction of stable local IDs.
          const progressRaw = localStorage.getItem(PROGRESS_KEY)
          if (progressRaw) {
            const progress = progressSchema.parse(JSON.parse(progressRaw))
            for (const [slug, id] of Object.entries(next.curriculum?.imports ?? {}))
              if (progress[slug]) progress[id] = progress[slug]
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
          }
        } else next.curriculum = emptyCurriculum()
        warning = saveWebOverlayWorkspace(next)
      } catch {
        warning =
          'The curriculum could not be fully restored. Original browser data is preserved. Import the curriculum file from the slide library to recover it.'
      }
    }
    workspaceRef.current = next
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWorkspace(next)
    setStorageWarning(warning)
    const syncFromHash = () =>
      setView(
        window.location.hash === '#builder'
          ? 'builder'
          : window.location.hash === '#library'
            ? 'library'
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
    const merged = {
      ...next,
      curriculum: next.curriculum ?? workspaceRef.current?.curriculum ?? emptyCurriculum(),
    }
    workspaceRef.current = merged
    setWorkspace(merged)
    const warning = saveWebOverlayWorkspace(merged)
    setStorageWarning(warning)
    return warning
  }, [])

  const chooseView = useCallback((nextView: WorkspaceView) => {
    setPreview(undefined)
    setView(nextView)
    const nextHash = nextView === 'demo' ? '' : `#${nextView}`
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${nextHash}`,
    )
  }, [])

  function editDocument(doc: SocratesSlideDocument) {
    const current = workspaceRef.current!
    updateWorkspace({ ...current, activeDocument: doc })
    chooseView('builder')
  }
  function assignDocument(doc: SocratesSlideDocument, value: SlideAssignment) {
    const current = workspaceRef.current!
    const curriculum = current.curriculum ?? emptyCurriculum()
    const upgraded = doc.schemaVersion === 2 ? doc : upgradeSocratesDocument(doc)
    updateWorkspace({
      ...current,
      activeDocument:
        documentKey(current.activeDocument) === documentKey(doc)
          ? upgraded
          : current.activeDocument,
      documents: current.documents.map((item) =>
        documentKey(item) === documentKey(doc) ? upgraded : item,
      ),
      curriculum: {
        ...curriculum,
        assignments: { ...curriculum.assignments, [documentKey(doc)]: value },
      },
    })
  }
  function previewDocument(doc: SocratesSlideDocument, mode: LearningMode) {
    try {
      const current = workspaceRef.current!
      const upgraded = upgradeSocratesDocument(doc)
      updateWorkspace({
        ...current,
        activeDocument: upgraded,
        documents: current.documents.map((item) =>
          documentKey(item) === documentKey(doc) ? upgraded : item,
        ),
      })
      chooseView('learn')
      setPreview({ id: documentKey(upgraded), mode })
    } catch {
      setStorageWarning(
        'Complete the required slide fields before opening a preview. Your edits are still available in the builder.',
      )
    }
  }
  function addDocument() {
    const current = workspaceRef.current!
    const recordId = crypto.randomUUID()
    const blank = upgradeSocratesDocument({
      ...createBlankSocratesDocument(),
      recordId,
      slug: `new-slide-${recordId}`,
      slide: createInvenioDemoDocument().slide,
    })
    updateWorkspace({ ...current, activeDocument: blank, documents: [blank, ...current.documents] })
    chooseView('builder')
  }

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
            Edit shared drafts, add teaching regions, and choose the teaching and testing sets.
            Drafts stay in this browser until you export them.
          </p>
        </div>
        <a href={`/${locale}/socrates-library`}>Open shared team library ↗</a>
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
            className={view === 'builder' || view === 'library' ? styles.activeView : undefined}
            aria-pressed={view === 'builder' || view === 'library'}
            onClick={() => chooseView('library')}
          >
            <FlaskConical aria-hidden="true" />
            <span>
              <strong>Slide library & builder</strong>
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

      {view === 'library' ? (
        <SlideLibrary
          workspace={workspace}
          onChange={updateWorkspace}
          onEdit={editDocument}
          onNew={addDocument}
          onAssign={assignDocument}
        />
      ) : view === 'learn' ? (
        <SocratesLearningWorkspace
          key={preview ? `${preview.id}-${preview.mode}` : 'modules'}
          documents={workspace.documents}
          assignments={workspace.curriculum?.assignments ?? {}}
          preview={preview}
          onLibrary={() => chooseView('library')}
          onEdit={editDocument}
        />
      ) : view === 'demo' ? (
        <SocratesDemo
          key={workspace.activeDocument.recordId ?? workspace.activeDocument.slug}
          slide={workspace.activeDocument.slide}
          annotations={workspace.activeDocument.annotations}
        />
      ) : (
        <>
          <div className={libraryStyles.editorTools}>
            <div>
              <button className={libraryStyles.secondary} onClick={() => chooseView('library')}>
                ← Back to slide library
              </button>
              <p>Edit this draft once; both previews use the same content.</p>
            </div>
            <div>
              <AssignmentSelect
                document={workspace.activeDocument}
                value={
                  workspace.curriculum?.assignments[documentKey(workspace.activeDocument)] ??
                  'unassigned'
                }
                onChange={(value) => assignDocument(workspace.activeDocument, value)}
              />
              <button
                className={libraryStyles.secondary}
                onClick={() => previewDocument(workspace.activeDocument, 'teaching')}
              >
                Preview teaching
              </button>
              <button
                className={libraryStyles.secondary}
                onClick={() => previewDocument(workspace.activeDocument, 'testing')}
              >
                Preview testing · tissue only
              </button>
            </div>
          </div>
          <SocratesBuilder
            access={{ canPersist: false, canPublish: false, userEmail: null }}
            initialDocuments={workspace.documents}
            initialActiveDocument={workspace.activeDocument}
            initialStorageError={storageWarning}
            mode="local"
            embedded
            onLocalWorkspaceChange={updateWorkspace}
            onPreviewTeaching={(doc) => previewDocument(doc, 'teaching')}
          />
        </>
      )}
    </div>
  )
}
