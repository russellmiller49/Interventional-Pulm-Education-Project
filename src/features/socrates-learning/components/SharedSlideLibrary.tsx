'use client'
import { useCallback, useRef, useState } from 'react'
import { SocratesBuilder } from '@/features/socrates-builder/components/SocratesBuilder'
import { createBlankSocratesDocument } from '@/features/socrates-builder/content/starter-document'
import { createInvenioDemoDocument } from '@/features/socrates-builder/content/invenio-demo-document'
import {
  readWebOverlayWorkspace,
  type WebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'
import { authorLibrarySchema } from '../author-library'
import { collectionSchema } from '../model'
import {
  compareTeachingDocuments,
  coreTeachingSequence,
  teachingSectionTitle,
} from '../core-teaching'
import { sharedDraft, sharedKey, type SharedSlide } from '../shared-library'
import { useSharedLibrary } from '../use-shared-library'
import { AssignmentSelect } from './SlideLibrary'
import { SocratesLearningWorkspace } from './SocratesLearningWorkspace'
import styles from './shared-library.module.css'

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
export function SharedSlideLibrary({
  initialSlides,
  canPublish,
  userId,
  locale,
}: {
  initialSlides: SharedSlide[]
  canPublish: boolean
  userId: string
  locale: string
}) {
  const library = useSharedLibrary(initialSlides, userId)
  const [active, setActive] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<'teaching' | 'testing' | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const entry = active ? library.entries[active] : undefined
  const selected = useRef(entry)
  selected.current = entry
  const edit = library.edit
  const change = useCallback(
    (next: WebOverlayWorkspace) => {
      const current = selected.current
      if (!current) return null
      if (
        next.activeDocument.recordId !== current.draft.document.recordId &&
        next.activeDocument.slide.descriptorUrl !== current.draft.document.slide.descriptorUrl
      ) {
        const draft = sharedDraft(next.activeDocument)
        edit(draft)
        setActive(draft.id)
      } else
        edit({
          ...current.draft,
          document: { ...next.activeDocument, recordId: current.draft.document.recordId },
        })
      return null
    },
    [edit],
  )
  function importWorkspace(workspace: WebOverlayWorkspace) {
    const keys = new Set(Object.values(library.entries).map((e) => e.draft.importKey))
    let added = 0
    for (const doc of workspace.documents) {
      const draft = sharedDraft(
        doc,
        workspace.curriculum?.assignments[doc.recordId ?? doc.slug] ?? 'unassigned',
      )
      if (keys.has(sharedKey(doc, draft.id))) continue
      keys.add(draft.importKey)
      library.edit(draft)
      added++
    }
    setMessage(
      `${added} drafts queued for shared saving. Existing source slides were preserved. Review any save errors below.`,
    )
  }
  function add() {
    const id = crypto.randomUUID()
    const draft = sharedDraft({
      ...createBlankSocratesDocument(),
      recordId: id,
      slug: `new-slide-${id}`,
      slide: createInvenioDemoDocument().slide,
    })
    library.edit(draft)
    setActive(id)
  }
  if (!library.ready) return <p role="status">Opening shared drafts…</p>
  return (
    <section className={styles.shell} aria-label="Shared slide authoring">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>SOCRATES · Author workspace</span>
          <h1>Shared slide library</h1>
          <p>
            Edits save to the team automatically. Publish a reviewed version when it is ready for
            learners.
          </p>
        </div>
        <a href={`/${locale}/socrates/learn`}>Open published modules ↗</a>
      </header>
      <div className={styles.status} role="status">
        {library.busy
          ? 'Saving to the team…'
          : Object.values(library.entries).some((e) => e.dirty)
            ? 'Some edits are not yet saved to the team.'
            : 'All changes saved to the team.'}{' '}
        <span>Team updates refresh every 10 seconds and when you return.</span>
      </div>
      {(library.notice || message) && <p role="alert">{library.notice || message}</p>}
      {entry ? (
        <>
          <div className={styles.toolbar}>
            <button
              onClick={() => {
                setActive(null)
                setPreview(null)
              }}
            >
              ← All slides
            </button>
            <AssignmentSelect
              document={entry.draft.document}
              value={entry.draft.assignment}
              onChange={(assignment) => library.edit({ ...entry.draft, assignment })}
            />
            <button onClick={() => setPreview('teaching')}>Preview teaching</button>
            <button onClick={() => setPreview('testing')}>Preview testing</button>
            {preview && <button onClick={() => setPreview(null)}>Return to editing</button>}
          </div>
          <section className={styles.release} aria-label="Publication status">
            <div>
              <strong>
                {entry.base?.publishedRevision
                  ? `Published to ${entry.base.publishedAssignment} · revision ${entry.base.publishedRevision}`
                  : 'Draft · not published'}
              </strong>
              <p>
                {entry.base?.publishedRevision
                  ? 'Learners keep seeing that version until you publish again.'
                  : 'Only the authoring team can see this draft.'}
              </p>
            </div>
            {canPublish && (
              <>
                <button
                  disabled={Boolean(library.busy) || entry.dirty || !entry.base}
                  onClick={() => void library.publish(entry.draft.id, true)}
                >
                  Publish reviewed version
                </button>
                {entry.base?.publishedRevision && (
                  <button
                    disabled={Boolean(library.busy) || entry.dirty}
                    onClick={() => void library.publish(entry.draft.id, false)}
                  >
                    Withdraw from learners
                  </button>
                )}
              </>
            )}
            {!canPublish && <span>A site administrator publishes reviewed slides.</span>}
          </section>
          {entry.error && (
            <section className={styles.conflict} role="alert">
              <strong>{entry.error}</strong>
              <div className={styles.toolbar}>
                <button
                  onClick={() => download(entry.draft.document, 'socrates-my-edits_PRIVATE.json')}
                >
                  Export my edits
                </button>
                {entry.conflict ? (
                  <button onClick={() => library.useLatest(entry.draft.id)}>
                    Use team version · keep recovery copy
                  </button>
                ) : (
                  <button onClick={() => void library.save(entry.draft.id)}>Retry saving</button>
                )}
              </div>
              {entry.conflict && (
                <details>
                  <summary>Compare local and team content</summary>
                  <div className={styles.compare}>
                    <pre>{JSON.stringify(entry.draft.document, null, 2)}</pre>
                    <pre>{JSON.stringify(entry.conflict.document, null, 2)}</pre>
                  </div>
                </details>
              )}
            </section>
          )}
          {preview ? (
            <SocratesLearningWorkspace
              documents={[entry.draft.document]}
              preview={{
                id: entry.draft.document.recordId ?? entry.draft.document.slug,
                mode: preview,
              }}
              onLibrary={() => setPreview(null)}
            />
          ) : (
            <SocratesBuilder
              key={`${active}-${entry.generation}`}
              mode="shared"
              embedded
              access={{ canPersist: true, canPublish: false, userEmail: null }}
              initialDocuments={[entry.draft.document]}
              initialActiveDocument={entry.draft.document}
              onLocalWorkspaceChange={change}
            />
          )}
        </>
      ) : (
        <>
          <div className={styles.toolbar}>
            <input
              aria-label="Search shared slides"
              placeholder="Search slides or diagnostic categories"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={add}>Build a new slide</button>
            <button
              onClick={() => {
                const restored = readWebOverlayWorkspace()
                if (restored.warning) setMessage(restored.warning)
                else importWorkspace(restored.workspace)
              }}
            >
              Import this browser’s drafts
            </button>
            <button onClick={() => file.current?.click()}>Import library file</button>
            <button onClick={() => void library.refresh()}>Refresh team changes</button>
            <button
              onClick={() => {
                const copies = Object.keys(localStorage)
                  .filter((k) => k.startsWith(`${library.recoveryKey}:recovery:`))
                  .map((k) => JSON.parse(localStorage.getItem(k)!))
                download(copies, 'socrates-recovery-copies_PRIVATE.json')
              }}
            >
              Export recovery copies
            </button>
            <input
              ref={file}
              type="file"
              accept=".json"
              aria-label="Import shared library JSON"
              hidden
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 30 * 1024 * 1024) throw Error('Choose a library smaller than 30 MB.')
                  const raw = JSON.parse(await f.text())
                  const collection = collectionSchema.safeParse(raw)
                  importWorkspace(
                    collection.success
                      ? {
                          version: 1,
                          activeDocument: collection.data.documents[0],
                          documents: collection.data.documents,
                        }
                      : authorLibrarySchema.parse(raw).workspace,
                  )
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Import failed.')
                } finally {
                  e.target.value = ''
                }
              }}
            />
          </div>
          {!Object.keys(library.entries).length && (
            <div className={styles.empty}>
              <h2>Start with your prepared slides</h2>
              <p>
                Import the browser drafts or a private library file once. Everyone with SOCRATES
                editor access will then see the same saved slides.
              </p>
            </div>
          )}
          <div className={styles.grid}>
            {Object.values(library.entries)
              .sort((a, b) => compareTeachingDocuments(a.draft.document, b.draft.document))
              .filter((e) =>
                `${e.draft.document.title} ${e.draft.document.caseContent?.diagnosticCategory}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((e) => (
                <article className={styles.card} key={e.draft.id}>
                  <span className={styles.eyebrow}>{e.draft.assignment}</span>
                  <h2>{e.draft.document.title}</h2>
                  {coreTeachingSequence(e.draft.document) && (
                    <p>
                      Core case {coreTeachingSequence(e.draft.document)!.position} ·{' '}
                      {teachingSectionTitle(coreTeachingSequence(e.draft.document)!)}
                    </p>
                  )}
                  <p>
                    {e.draft.document.caseContent?.diagnosticCategory || 'Category pending'} ·{' '}
                    {e.draft.document.caseContent?.subcategory}
                  </p>
                  <p>
                    {e.error
                      ? 'Save needs attention'
                      : e.dirty
                        ? 'Waiting to save'
                        : `Shared draft · revision ${e.base?.document.revision}`}
                  </p>
                  <p>
                    {e.base?.publishedRevision
                      ? `Published: ${e.base.publishedAssignment} · revision ${e.base.publishedRevision}`
                      : 'Not published'}
                  </p>
                  <button onClick={() => setActive(e.draft.id)}>Edit slide</button>
                </article>
              ))}
          </div>
        </>
      )}
    </section>
  )
}
