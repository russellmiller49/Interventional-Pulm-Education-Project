'use client'

import { useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, BoxSelect, Download, Plus, Search, Upload } from 'lucide-react'
import type { SocratesSlideDocument } from '@/features/socrates-builder/types'
import type {
  SlideAssignment,
  WebOverlayWorkspace,
} from '@/features/socrates-builder/web-overlay-storage'
import { documentKey, exportAuthorLibrary, importAuthorLibrary } from '../author-library'
import styles from './library.module.css'
import {
  compareTeachingDocuments,
  coreTeachingSequence,
  teachingSectionTitle,
} from '../core-teaching'

export function AssignmentSelect({
  document,
  value,
  onChange,
}: {
  document: SocratesSlideDocument
  value: SlideAssignment
  onChange: (value: SlideAssignment) => void
}) {
  return (
    <label className={styles.assignment}>
      Module assignment
      <select
        aria-label={`Module assignment for ${document.title}`}
        value={value}
        onChange={(event) => onChange(event.target.value as SlideAssignment)}
      >
        <option value="unassigned">Unassigned</option>
        <option value="teaching">Teaching</option>
        <option value="testing">Testing</option>
      </select>
    </label>
  )
}

export function SlideLibrary({
  workspace,
  onChange,
  onEdit,
  onNew,
  onAssign,
}: {
  workspace: WebOverlayWorkspace
  onChange: (next: WebOverlayWorkspace) => string | null
  onEdit: (document: SocratesSlideDocument) => void
  onNew: () => void
  onAssign: (document: SocratesSlideDocument, assignment: SlideAssignment) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [source, setSource] = useState(
    workspace.curriculum?.importedIds.includes(documentKey(workspace.activeDocument))
      ? 'curriculum'
      : 'all',
  )
  const [notice, setNotice] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const imported = new Set(workspace.curriculum?.importedIds)
  const assignment = (doc: SocratesSlideDocument) =>
    workspace.curriculum?.assignments[documentKey(doc)] ?? 'unassigned'
  const documents = [...workspace.documents].sort(compareTeachingDocuments).filter((doc) => {
    const sourceValues = doc.authorContent?.curriculumSource?.sourceValues
    return (
      (source === 'all' ||
        (source === 'curriculum'
          ? imported.has(documentKey(doc))
          : !imported.has(documentKey(doc)))) &&
      (filter === 'all' || assignment(doc) === filter) &&
      `${doc.title} ${doc.slug} ${sourceValues?.['Full Case Name'] ?? ''} ${sourceValues?.Module ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
  })
  async function importFile(file?: File) {
    if (!file) return
    try {
      if (file.size > 10_000_000) throw new Error('The library file is too large (maximum 10 MB).')
      const next = importAuthorLibrary(workspace, JSON.parse(await file.text()))
      const added = next.documents.length - workspace.documents.length
      const warning = onChange(next)
      setSource('all')
      setFilter('all')
      setQuery('')
      setNotice(warning ?? `${added} slides added. Existing edits and assignments were preserved.`)
    } catch {
      setNotice(
        'Unable to import this file. Use a SOCRATES draft curriculum or exported author library JSON file. Your existing slides are unchanged.',
      )
    } finally {
      if (input.current) input.current.value = ''
    }
  }
  function exportLibrary() {
    try {
      const bundle = exportAuthorLibrary(workspace)
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
      )
      const link = document.createElement('a')
      link.href = url
      link.download = 'socrates-author-library_PRIVATE.json'
      link.click()
      URL.revokeObjectURL(url)
      setNotice(
        'Author library exported with slide context, bounding boxes, and module assignments. It includes private author notes; share it with the authoring team only.',
      )
    } catch {
      setNotice(
        'Export could not finish. Complete the required slide fields before exporting the library.',
      )
    }
  }
  return (
    <div className={styles.library}>
      <div className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>SOCRATES · Author workspace</span>
          <h1>
            One slide library.
            <br />
            Two learning modules.
          </h1>
          <p>
            Develop the prepared drafts into teaching slides, or build a new slide. Add context and
            bounding boxes, preview either version, then choose its module.
          </p>
        </div>
        <button className={styles.primary} onClick={onNew}>
          <Plus size={19} /> Build a new slide
        </button>
      </div>
      <div className={styles.summary}>
        {(['all', 'unassigned', 'teaching', 'testing'] as const).map((value) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            <strong>
              {
                workspace.documents.filter((doc) => value === 'all' || assignment(doc) === value)
                  .length
              }
            </strong>
            <span>
              {value === 'all'
                ? 'Total drafts'
                : value === 'unassigned'
                  ? 'Awaiting assignment'
                  : value === 'teaching'
                    ? 'Teaching'
                    : 'Testing · tissue only'}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} />
          <input
            aria-label="Search slides"
            placeholder="Search cases, slide titles, or curriculum sections…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className={styles.source}>
          Show
          <select
            aria-label="Slide source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">All slides ({workspace.documents.length})</option>
            <option value="curriculum">Prepared curriculum ({imported.size})</option>
            <option value="other">
              Other drafts ({workspace.documents.length - imported.size})
            </option>
          </select>
        </label>
        <button className={styles.secondary} onClick={() => input.current?.click()}>
          <Upload size={16} /> Import library
        </button>
        <button className={styles.secondary} onClick={exportLibrary}>
          <Download size={16} /> Export library
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          aria-label="Import SOCRATES author library"
          hidden
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </div>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.listHeading}>
        <span>{documents.length} slides shown</span>
        <span>Auto-saved in this browser · unpublished</span>
      </div>
      <div className={styles.list}>
        {documents.map((doc) => {
          const values = doc.authorContent?.curriculumSource?.sourceValues
          return (
            <article key={documentKey(doc)} className={styles.row}>
              <div className={styles.slideIcon}>
                <BookOpen size={24} />
              </div>
              <div className={styles.description}>
                <span className={styles.eyebrow}>
                  {coreTeachingSequence(doc)
                    ? `Core case ${coreTeachingSequence(doc)!.position} · ${teachingSectionTitle(coreTeachingSequence(doc)!)}`
                    : (values?.Module ?? 'Author draft')}
                </span>
                <h2>{doc.title}</h2>
                <p>{values?.['Full Case Name'] ?? doc.slug}</p>
                <small>
                  <BoxSelect size={14} />{' '}
                  {doc.annotations.length
                    ? `${doc.annotations.length} teaching regions`
                    : 'Bounding boxes to add'}
                </small>
              </div>
              <AssignmentSelect
                document={doc}
                value={assignment(doc)}
                onChange={(value) => onAssign(doc, value)}
              />
              <button
                className={styles.secondary}
                onClick={() => onEdit(doc)}
                aria-label={`Edit ${doc.title}`}
              >
                Edit slide <ArrowUpRight size={16} />
              </button>
            </article>
          )
        })}
        {!documents.length && (
          <p className={styles.empty}>
            No slides match these filters. Try another source or search, or build a new slide.
          </p>
        )}
      </div>
      <p className={styles.footnote}>
        Assignments organize these draft modules. You can change them before launch. Export the
        library to move drafts between browsers or share them with the SOCRATES authoring team.
      </p>
    </div>
  )
}
