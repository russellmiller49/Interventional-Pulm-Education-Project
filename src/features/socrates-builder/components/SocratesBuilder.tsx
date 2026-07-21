'use client'

import {
  type ChangeEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocale } from 'next-intl'
import {
  BoxSelect,
  Check,
  ChevronDown,
  CirclePlus,
  Download,
  Eye,
  FileJson,
  Hand,
  LoaderCircle,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'

import {
  deleteSocratesSandboxDocumentAsAdmin,
  publishSocratesSlideDocument,
  saveSocratesSlideDocument,
} from '@/app/[locale]/socrates-builder/actions'
import {
  deleteSocratesSandboxDocument,
  saveSocratesSandboxDocument,
} from '@/app/[locale]/socrates-demo/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeepZoomViewer } from '@/features/socrates-demo/components/DeepZoomViewer'
import {
  findDeepestAnnotationAtPoint,
  polygonBounds,
  rectangleToPolygon,
  rectContainsRect,
} from '@/features/socrates-demo/engine/geometry'
import type {
  DeepZoomViewerHandle,
  DeepZoomViewerStatus,
  DemoAnnotation,
  ImagePoint,
  ImageRect,
  ViewportSnapshot,
} from '@/features/socrates-demo/types'

import {
  createBlankSocratesDocument,
  createStarterSocratesDocument,
} from '../content/starter-document'
import { loadInvenioDziDescriptor, resolveSocratesSlideSource } from '../descriptor'
import {
  createSandboxEditKey,
  forgetSandboxEditKey,
  readSandboxEditKey,
  rememberSandboxEditKey,
} from '../sandbox-edit-key'
import { parseSocratesSlideDocument, validateSocratesSlideDocument } from '../schema'
import type {
  SocratesBuilderAccess,
  SocratesBuilderMode,
  SocratesDrawMode,
  SocratesSlideDocument,
} from '../types'
import styles from './socrates-builder.module.css'

interface SocratesBuilderProps {
  access: SocratesBuilderAccess
  initialDocuments: SocratesSlideDocument[]
  mode?: SocratesBuilderMode
  sandboxCleanupDocuments?: SocratesSlideDocument[]
  embedded?: boolean
  onDocumentsChange?: (documents: SocratesSlideDocument[]) => void
}

interface ActionNotice {
  tone: 'info' | 'success' | 'error'
  message: string
}

function cloneAnnotations(annotations: readonly DemoAnnotation[]): DemoAnnotation[] {
  return annotations.map((annotation) => ({
    ...annotation,
    polygon: [
      { ...annotation.polygon[0] },
      { ...annotation.polygon[1] },
      { ...annotation.polygon[2] },
      { ...annotation.polygon[3] },
    ] as const,
  }))
}

function cloneDocument(document: SocratesSlideDocument): SocratesSlideDocument {
  return {
    ...document,
    slide: {
      ...document.slide,
      expectedDimensions: { ...document.slide.expectedDimensions },
      initialImageRect: { ...document.slide.initialImageRect },
      attribution: { ...document.slide.attribution },
    },
    annotations: cloneAnnotations(document.annotations),
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'invenio-slide'
  )
}

function clampRectangleToSlide(rect: ImageRect, width: number, height: number): ImageRect {
  const x = Math.max(0, Math.min(rect.x, width))
  const y = Math.max(0, Math.min(rect.y, height))
  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width, width - x)),
    height: Math.max(0, Math.min(rect.height, height - y)),
  }
}

function nextAnnotationId() {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().split('-')[0]
      : Math.random().toString(36).slice(2, 10)
  return `region-${randomPart}`
}

function replaceDocumentInCatalog(
  documents: SocratesSlideDocument[],
  document: SocratesSlideDocument,
) {
  const matchIndex = documents.findIndex(
    (candidate) =>
      (document.recordId && candidate.recordId === document.recordId) ||
      (!document.recordId && candidate.slug === document.slug),
  )
  if (matchIndex < 0) return [cloneDocument(document), ...documents]

  return documents.map((candidate, index) =>
    index === matchIndex ? cloneDocument(document) : candidate,
  )
}

function statusVariant(status: SocratesSlideDocument['workflowStatus']) {
  if (status === 'published') return 'success' as const
  if (status === 'review') return 'info' as const
  return 'outline' as const
}

export function SocratesBuilder({
  access,
  initialDocuments,
  mode = 'protected',
  sandboxCleanupDocuments = [],
  embedded = false,
  onDocumentsChange,
}: SocratesBuilderProps) {
  const locale = useLocale()
  const initialDocument = initialDocuments[0]
    ? cloneDocument(initialDocuments[0])
    : createStarterSocratesDocument()
  const viewerRef = useRef<DeepZoomViewerHandle | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [documents, setDocuments] = useState(() => initialDocuments.map(cloneDocument))
  const [document, setDocument] = useState<SocratesSlideDocument>(initialDocument)
  const [descriptorInput, setDescriptorInput] = useState(initialDocument.slide.descriptorUrl)
  const [selectedId, setSelectedId] = useState(initialDocument.annotations[0]?.id ?? '')
  const [previewedId, setPreviewedId] = useState<string | null>(null)
  const [drawMode, setDrawMode] = useState<SocratesDrawMode>('navigate')
  const [viewerStatus, setViewerStatus] = useState<DeepZoomViewerStatus>({ phase: 'loading' })
  const [viewport, setViewport] = useState<ViewportSnapshot>({
    zoomRatio: 1,
    visibleImageBounds: initialDocument.slide.initialImageRect,
  })
  const [annotationHistory, setAnnotationHistory] = useState<DemoAnnotation[][]>([])
  const [annotationFuture, setAnnotationFuture] = useState<DemoAnnotation[][]>([])
  const [dirty, setDirty] = useState(!initialDocument.recordId)
  const [loadingDescriptor, setLoadingDescriptor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<ActionNotice | null>(null)
  const [ownedSandboxIds, setOwnedSandboxIds] = useState<Set<string>>(new Set())
  const [cleanupDocuments, setCleanupDocuments] = useState(() =>
    sandboxCleanupDocuments.map(cloneDocument),
  )

  const isSandbox = mode === 'sandbox'

  const selectedAnnotation = document.annotations.find((annotation) => annotation.id === selectedId)
  const selectedBounds = selectedAnnotation ? polygonBounds(selectedAnnotation.polygon) : null
  const parentAnnotations = document.annotations.filter(
    (annotation) => annotation.style === 'parent',
  )
  const allVisibleIds = useMemo(
    () => new Set(document.annotations.map((annotation) => annotation.id)),
    [document.annotations],
  )

  useEffect(() => {
    if (!isSandbox) return
    setOwnedSandboxIds(
      new Set(
        documents.flatMap((candidate) =>
          candidate.recordId && readSandboxEditKey(candidate.recordId) ? [candidate.recordId] : [],
        ),
      ),
    )
  }, [documents, isSandbox])

  const setDirtyDocument = useCallback((updater: SetStateAction<SocratesSlideDocument>) => {
    setDocument(updater)
    setDirty(true)
    setNotice(null)
  }, [])

  const commitAnnotations = useCallback(
    (nextAnnotations: DemoAnnotation[]) => {
      setAnnotationHistory((history) => [
        ...history.slice(-39),
        cloneAnnotations(document.annotations),
      ])
      setAnnotationFuture([])
      setDirtyDocument((current) => ({
        ...current,
        annotations: cloneAnnotations(nextAnnotations),
      }))
    },
    [document.annotations, setDirtyDocument],
  )

  const selectDocument = useCallback((nextDocument: SocratesSlideDocument) => {
    const clone = cloneDocument(nextDocument)
    setDocument(clone)
    setDescriptorInput(clone.slide.descriptorUrl)
    setSelectedId(clone.annotations[0]?.id ?? '')
    setPreviewedId(null)
    setDrawMode('navigate')
    setAnnotationHistory([])
    setAnnotationFuture([])
    setDirty(false)
    setNotice(null)
  }, [])

  const addNewSlide = useCallback(() => {
    const blank = createBlankSocratesDocument()
    selectDocument(blank)
    setDirty(true)
  }, [selectDocument])

  const undoAnnotations = useCallback(() => {
    const previous = annotationHistory.at(-1)
    if (!previous) return
    setAnnotationHistory((history) => history.slice(0, -1))
    setAnnotationFuture((future) => [
      cloneAnnotations(document.annotations),
      ...future.slice(0, 39),
    ])
    setDirtyDocument((current) => ({ ...current, annotations: cloneAnnotations(previous) }))
    setSelectedId((currentId) =>
      previous.some((annotation) => annotation.id === currentId)
        ? currentId
        : (previous[0]?.id ?? ''),
    )
  }, [annotationHistory, document.annotations, setDirtyDocument])

  const redoAnnotations = useCallback(() => {
    const next = annotationFuture[0]
    if (!next) return
    setAnnotationFuture((future) => future.slice(1))
    setAnnotationHistory((history) => [
      ...history.slice(-39),
      cloneAnnotations(document.annotations),
    ])
    setDirtyDocument((current) => ({ ...current, annotations: cloneAnnotations(next) }))
    setSelectedId((currentId) =>
      next.some((annotation) => annotation.id === currentId) ? currentId : (next[0]?.id ?? ''),
    )
  }, [annotationFuture, document.annotations, setDirtyDocument])

  const updateAnnotation = useCallback(
    (annotationId: string, updater: (annotation: DemoAnnotation) => DemoAnnotation) => {
      setDirtyDocument((current) => ({
        ...current,
        annotations: current.annotations.map((annotation) =>
          annotation.id === annotationId ? updater(annotation) : annotation,
        ),
      }))
    },
    [setDirtyDocument],
  )

  const updateSelectedBounds = useCallback(
    (field: keyof ImageRect, value: number) => {
      if (!selectedAnnotation || !selectedBounds || !Number.isFinite(value)) return
      const nextBounds = clampRectangleToSlide(
        { ...selectedBounds, [field]: value },
        document.slide.expectedDimensions.width,
        document.slide.expectedDimensions.height,
      )
      if (nextBounds.width < 1 || nextBounds.height < 1) return
      const selectedParent = selectedAnnotation.parentId
        ? document.annotations.find((annotation) => annotation.id === selectedAnnotation.parentId)
        : undefined
      if (
        selectedAnnotation.style === 'detail' &&
        selectedParent &&
        !rectContainsRect(polygonBounds(selectedParent.polygon), nextBounds)
      ) {
        setNotice({ tone: 'error', message: 'Detail regions must remain inside their parent.' })
        return
      }
      commitAnnotations(
        document.annotations.map((annotation) =>
          annotation.id === selectedAnnotation.id
            ? { ...annotation, polygon: rectangleToPolygon(nextBounds) }
            : annotation,
        ),
      )
    },
    [
      commitAnnotations,
      document.annotations,
      document.slide.expectedDimensions,
      selectedAnnotation,
      selectedBounds,
    ],
  )

  const deleteSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotation) return
    const removeIds = new Set([selectedAnnotation.id])
    let foundChild = true
    while (foundChild) {
      foundChild = false
      for (const annotation of document.annotations) {
        if (
          annotation.parentId &&
          removeIds.has(annotation.parentId) &&
          !removeIds.has(annotation.id)
        ) {
          removeIds.add(annotation.id)
          foundChild = true
        }
      }
    }
    const next = document.annotations.filter((annotation) => !removeIds.has(annotation.id))
    commitAnnotations(next)
    setSelectedId(next[0]?.id ?? '')
  }, [commitAnnotations, document.annotations, selectedAnnotation])

  const handleRectangleDrawn = useCallback(
    (rawRectangle: ImageRect) => {
      const rectangle = clampRectangleToSlide(
        rawRectangle,
        document.slide.expectedDimensions.width,
        document.slide.expectedDimensions.height,
      )
      if (rectangle.width < 2 || rectangle.height < 2) return

      const isDetail = drawMode === 'detail'
      const selectedParent =
        selectedAnnotation?.style === 'parent' ? selectedAnnotation : parentAnnotations[0]
      if (isDetail && !selectedParent) {
        setNotice({ tone: 'error', message: 'Create or select a parent region first.' })
        return
      }
      if (
        isDetail &&
        selectedParent &&
        !rectContainsRect(polygonBounds(selectedParent.polygon), rectangle)
      ) {
        setNotice({ tone: 'error', message: 'Draw the detail region inside its parent region.' })
        return
      }

      const id = nextAnnotationId()
      const sequence = document.annotations.length + 1
      const annotation: DemoAnnotation = {
        id,
        ...(isDetail && selectedParent ? { parentId: selectedParent.id } : {}),
        label: isDetail ? `Detail ${sequence}` : `Zone ${sequence}`,
        polygon: rectangleToPolygon(rectangle),
        style: isDetail ? 'detail' : 'parent',
        enterZoomRatio: isDetail ? 1.75 : 0,
        exitZoomRatio: isDetail ? 1.55 : 0,
        summary: 'Illustrative annotation awaiting author review.',
        placeholderNote: 'Placeholder annotation—not clinically reviewed.',
        sortOrder: sequence - 1,
      }
      commitAnnotations([...document.annotations, annotation])
      setSelectedId(id)
      setNotice({ tone: 'success', message: `${annotation.label} added in source-image pixels.` })
    },
    [
      commitAnnotations,
      document.annotations,
      document.slide.expectedDimensions,
      drawMode,
      parentAnnotations,
      selectedAnnotation,
    ],
  )

  const handleImageSelect = useCallback(
    (point: ImagePoint) => {
      const annotation = findDeepestAnnotationAtPoint(document.annotations, allVisibleIds, point)
      if (annotation) setSelectedId(annotation.id)
    },
    [allVisibleIds, document.annotations],
  )

  const handleImageHover = useCallback(
    (point: ImagePoint | null) => {
      const annotation = point
        ? findDeepestAnnotationAtPoint(document.annotations, allVisibleIds, point)
        : null
      setPreviewedId(annotation?.id ?? null)
    },
    [allVisibleIds, document.annotations],
  )

  const loadDescriptor = useCallback(async () => {
    setLoadingDescriptor(true)
    setNotice(null)
    try {
      const source = resolveSocratesSlideSource(descriptorInput)
      const descriptor = await loadInvenioDziDescriptor(source.descriptorUrl)
      const slideKey = source.slideKey
      const fullView = { x: 0, y: 0, width: descriptor.width, height: descriptor.height }
      const currentInitialView = document.slide.initialImageRect
      const descriptorChanged = Boolean(slideKey && slideKey !== document.slide.id)

      if (source.initialImageRect && !rectContainsRect(fullView, source.initialImageRect)) {
        throw new Error('The Thinviewer starting crop lies outside the slide dimensions.')
      }

      const initialImageRect = source.initialImageRect
        ? source.initialImageRect
        : !descriptorChanged && rectContainsRect(fullView, currentInitialView)
          ? currentInitialView
          : fullView
      setDirtyDocument((current) => ({
        ...current,
        slug: current.recordId ? current.slug : slugify(slideKey || current.title),
        title:
          current.recordId || (!descriptorChanged && current.title !== 'New Invenio slide')
            ? current.title
            : slideKey.replaceAll('_', ' '),
        slide: {
          ...current.slide,
          id: slideKey || current.slide.id,
          descriptorUrl: source.descriptorUrl,
          expectedDimensions: { width: descriptor.width, height: descriptor.height },
          initialImageRect,
          attribution: {
            ...current.slide.attribution,
            href:
              source.attributionUrl ??
              (descriptorChanged ? source.descriptorUrl : current.slide.attribution.href),
          },
        },
        annotations: descriptorChanged ? [] : current.annotations,
      }))
      setDescriptorInput(source.descriptorUrl)
      setViewport({ zoomRatio: 1, visibleImageBounds: initialImageRect })
      setPreviewedId(null)
      if (descriptorChanged) {
        setSelectedId('')
        setDrawMode('navigate')
        setAnnotationHistory([])
        setAnnotationFuture([])
      }
      setNotice({
        tone: 'success',
        message: `${source.attributionUrl ? 'Thinviewer link resolved. ' : ''}Loaded ${descriptor.width} × ${descriptor.height} JPEG pyramid (${descriptor.tileSize}px tiles).${descriptorChanged ? ' Regions from the previous slide were cleared.' : ''}`,
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to load the DZI descriptor.',
      })
    } finally {
      setLoadingDescriptor(false)
    }
  }, [descriptorInput, document.slide.id, document.slide.initialImageRect, setDirtyDocument])

  const saveDocument = useCallback(
    async (workflowStatus: 'draft' | 'review') => {
      const requestedStatus = isSandbox ? 'draft' : workflowStatus
      const nextDocument = { ...document, workflowStatus: requestedStatus }
      const validation = validateSocratesSlideDocument(nextDocument)
      if (!validation.success) {
        setNotice({
          tone: 'error',
          message: validation.error.issues[0]?.message ?? 'Invalid slide.',
        })
        return
      }
      if (!access.canPersist) {
        setNotice({
          tone: 'error',
          message: isSandbox
            ? 'Sandbox saving is temporarily unavailable. You can still export a JSON copy.'
            : 'Database saving requires a signed-in SOCRATES editor account.',
        })
        return
      }

      setSaving(true)
      setNotice(null)
      let sandboxEditKey: string | null = null
      let sandboxTargetId: string | undefined
      let sandboxWasForked = false
      if (isSandbox) {
        sandboxEditKey = document.recordId ? readSandboxEditKey(document.recordId) : null
        sandboxTargetId = sandboxEditKey ? document.recordId : undefined
        sandboxWasForked = Boolean(document.recordId && !sandboxEditKey)
        try {
          sandboxEditKey ??= createSandboxEditKey()
        } catch (error) {
          setSaving(false)
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : 'Unable to create a secure edit key.',
          })
          return
        }
      }

      const result = isSandbox
        ? await saveSocratesSandboxDocument(nextDocument, sandboxEditKey!, sandboxTargetId)
        : await saveSocratesSlideDocument(nextDocument)
      setSaving(false)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error })
        return
      }

      const saved = cloneDocument(result.document)
      if (isSandbox && saved.recordId && sandboxEditKey) {
        const remembered = rememberSandboxEditKey(saved.recordId, sandboxEditKey)
        if (remembered) {
          setOwnedSandboxIds((current) => new Set(current).add(saved.recordId!))
        }
      }
      setDocument(saved)
      const nextDocuments = replaceDocumentInCatalog(documents, saved)
      setDocuments(nextDocuments)
      onDocumentsChange?.(nextDocuments.map(cloneDocument))
      setDirty(false)
      setNotice({
        tone: 'success',
        message: isSandbox
          ? sandboxWasForked
            ? `Saved as your editable sandbox copy (revision ${saved.revision}).`
            : `Sandbox revision ${saved.revision} saved.`
          : workflowStatus === 'review'
            ? 'Submitted for review.'
            : `Draft revision ${saved.revision} saved.`,
      })
    },
    [access.canPersist, document, documents, isSandbox, onDocumentsChange],
  )

  const deleteCurrentSandboxDocument = useCallback(async () => {
    if (!isSandbox || !document.recordId) return
    const editKey = readSandboxEditKey(document.recordId)
    if (!editKey) {
      setNotice({
        tone: 'error',
        message: 'This shared draft belongs to another browser. Saving it creates your own copy.',
      })
      return
    }

    setSaving(true)
    setNotice(null)
    const result = await deleteSocratesSandboxDocument(document.recordId, editKey)
    setSaving(false)
    if (!result.ok) {
      setNotice({ tone: 'error', message: result.error })
      return
    }

    forgetSandboxEditKey(result.recordId)
    setOwnedSandboxIds((current) => {
      const next = new Set(current)
      next.delete(result.recordId)
      return next
    })
    const remaining = documents.filter((candidate) => candidate.recordId !== result.recordId)
    setDocuments(remaining)
    onDocumentsChange?.(remaining.map(cloneDocument))
    if (remaining[0]) {
      selectDocument(remaining[0])
    } else {
      const starter = createStarterSocratesDocument()
      selectDocument(starter)
      setDirty(true)
    }
    setNotice({ tone: 'success', message: 'Your sandbox draft was deleted.' })
  }, [document.recordId, documents, isSandbox, onDocumentsChange, selectDocument])

  const deleteSandboxDocumentAsAdmin = useCallback(
    async (recordId: string) => {
      if (!access.canPublish) return
      setSaving(true)
      setNotice(null)
      const result = await deleteSocratesSandboxDocumentAsAdmin(recordId)
      setSaving(false)
      if (!result.ok) {
        setNotice({ tone: 'error', message: result.error })
        return
      }
      setCleanupDocuments((current) =>
        current.filter((candidate) => candidate.recordId !== result.recordId),
      )
      setNotice({ tone: 'success', message: 'Sandbox submission deleted.' })
    },
    [access.canPublish],
  )

  const publishDocument = useCallback(async () => {
    if (!document.recordId || dirty) {
      setNotice({ tone: 'error', message: 'Save the current draft before publishing.' })
      return
    }
    if (!access.canPublish) {
      setNotice({ tone: 'error', message: 'Only a site administrator can publish slides.' })
      return
    }

    setSaving(true)
    setNotice(null)
    const result = await publishSocratesSlideDocument(document.recordId)
    setSaving(false)
    if (!result.ok) {
      setNotice({ tone: 'error', message: result.error })
      return
    }

    const published = cloneDocument(result.document)
    setDocument(published)
    setDocuments((current) => replaceDocumentInCatalog(current, published))
    setDirty(false)
    setNotice({ tone: 'success', message: `Published revision ${published.revision}.` })
  }, [access.canPublish, dirty, document.recordId])

  const exportDocument = useCallback(() => {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `${document.slug || 'socrates-slide'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice({ tone: 'success', message: 'JSON backup exported.' })
  }, [document])

  const importDocument = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      try {
        const imported = parseSocratesSlideDocument(JSON.parse(await file.text()))
        const draftCopy = {
          ...cloneDocument(imported),
          recordId: undefined,
          slug: `${slugify(imported.slug)}-copy`,
          workflowStatus: 'draft' as const,
          revision: 0,
          publishedAt: null,
        }
        selectDocument(draftCopy)
        setDirty(true)
        setNotice({ tone: 'success', message: 'JSON imported as a new draft copy.' })
      } catch (error) {
        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'The JSON file is invalid.',
        })
      }
    },
    [selectDocument],
  )

  const setInitialView = useCallback(() => {
    const rect = clampRectangleToSlide(
      viewport.visibleImageBounds,
      document.slide.expectedDimensions.width,
      document.slide.expectedDimensions.height,
    )
    if (rect.width < 1 || rect.height < 1) return
    setDirtyDocument((current) => ({
      ...current,
      slide: { ...current.slide, initialImageRect: rect },
    }))
    setNotice({ tone: 'success', message: 'Current viewport saved as the starting crop.' })
  }, [document.slide.expectedDimensions, setDirtyDocument, viewport.visibleImageBounds])

  const updateSlideField = useCallback(
    <Key extends keyof SocratesSlideDocument['slide']>(
      key: Key,
      value: SocratesSlideDocument['slide'][Key],
    ) => {
      setDirtyDocument((current) => ({
        ...current,
        slide: { ...current.slide, [key]: value },
      }))
    },
    [setDirtyDocument],
  )

  return (
    <div className={`${styles.page} ${embedded ? styles.embedded : ''}`}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>
            {isSandbox ? 'Open company sandbox' : 'Protected authoring workspace'}
          </div>
          <h1>{isSandbox ? 'Build and annotate a slide' : 'SOCRATES slide builder'}</h1>
          <p>
            {isSandbox
              ? 'Add an Invenio slide, draw source-pixel regions, and save a disposable draft—no account required.'
              : 'Connect an approved Invenio pyramid, draw source-pixel regions, and publish a locked snapshot to the public demo.'}
          </p>
        </div>
        <div className={styles.heroMeta}>
          <Badge variant={access.canPersist ? 'success' : 'outline'}>
            {isSandbox
              ? access.canPersist
                ? 'Anonymous sandbox saving'
                : 'Local preview'
              : access.canPersist
                ? 'Database connected'
                : 'Local preview'}
          </Badge>
          {access.userEmail ? <span>{access.userEmail}</span> : null}
        </div>
      </header>

      <div className={styles.safetyBanner} role="note">
        <strong>
          {isSandbox
            ? 'Shared sandbox: do not enter patient or confidential information.'
            : 'Authoring content is illustrative until reviewed.'}
        </strong>
        <span>
          {isSandbox
            ? 'Anyone with this unlisted URL can view saved drafts. Sandbox drafts never publish to the production demo.'
            : 'No annotation is clinical guidance. Publishing requires site-administrator review.'}
        </span>
      </div>

      <section className={styles.workspace} aria-label="SOCRATES annotation workspace">
        <aside className={styles.catalog} aria-label="Slide catalog">
          <div className={styles.panelHeading}>
            <div>
              <span>Library</span>
              <h2>Slides</h2>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={addNewSlide}
              aria-label="Add slide"
            >
              <CirclePlus aria-hidden="true" />
            </Button>
          </div>

          <div className={styles.catalogList}>
            {documents.map((catalogDocument) => (
              <button
                type="button"
                key={catalogDocument.recordId ?? catalogDocument.slug}
                className={
                  catalogDocument.recordId === document.recordId && document.recordId
                    ? styles.catalogItemActive
                    : styles.catalogItem
                }
                onClick={() => selectDocument(catalogDocument)}
              >
                <span>{catalogDocument.title}</span>
                <small>
                  <Badge
                    variant={
                      isSandbox && ownedSandboxIds.has(catalogDocument.recordId ?? '')
                        ? 'success'
                        : statusVariant(catalogDocument.workflowStatus)
                    }
                    size="sm"
                  >
                    {isSandbox
                      ? ownedSandboxIds.has(catalogDocument.recordId ?? '')
                        ? 'your draft'
                        : 'shared'
                      : catalogDocument.workflowStatus}
                  </Badge>
                  <span>v{catalogDocument.revision}</span>
                </small>
              </button>
            ))}
            {documents.length === 0 ? (
              <div className={styles.emptyCatalog}>
                <FileJson aria-hidden="true" />
                <strong>Starter draft</strong>
                <span>Load and save the sample, or add another Invenio slide.</span>
              </div>
            ) : null}
          </div>

          <div className={styles.catalogActions}>
            <Button type="button" variant="outline" size="sm" onClick={exportDocument}>
              <Download aria-hidden="true" /> Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload aria-hidden="true" /> Import copy
            </Button>
            <input
              ref={importInputRef}
              className={styles.visuallyHidden}
              type="file"
              accept="application/json,.json"
              onChange={importDocument}
              aria-label="Import SOCRATES JSON"
            />
          </div>

          {!isSandbox && access.canPublish ? (
            <div className={styles.cleanupPanel}>
              <div>
                <span>Public sandbox</span>
                <strong>{cleanupDocuments.length} submissions</strong>
              </div>
              {cleanupDocuments.length ? (
                <div className={styles.cleanupList}>
                  {cleanupDocuments.map((sandboxDocument) => (
                    <div key={sandboxDocument.recordId ?? sandboxDocument.slug}>
                      <span title={sandboxDocument.title}>{sandboxDocument.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          sandboxDocument.recordId
                            ? void deleteSandboxDocumentAsAdmin(sandboxDocument.recordId)
                            : undefined
                        }
                        disabled={saving || !sandboxDocument.recordId}
                        aria-label={`Delete sandbox submission ${sandboxDocument.title}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <small>No sandbox submissions to clean up.</small>
              )}
            </div>
          ) : null}
        </aside>

        <section className={styles.viewerPanel} aria-label="Slide annotation canvas">
          <div className={styles.viewerToolbar}>
            <div className={styles.modeGroup} role="group" aria-label="Annotation mode">
              <ToolButton
                active={drawMode === 'navigate'}
                onClick={() => setDrawMode('navigate')}
                label="Pan and select"
              >
                <Hand aria-hidden="true" />
              </ToolButton>
              <ToolButton
                active={drawMode === 'parent'}
                onClick={() => setDrawMode('parent')}
                label="Draw parent region"
              >
                <BoxSelect aria-hidden="true" /> Parent
              </ToolButton>
              <ToolButton
                active={drawMode === 'detail'}
                onClick={() => setDrawMode('detail')}
                label="Draw detail region"
              >
                <BoxSelect aria-hidden="true" /> Detail
              </ToolButton>
            </div>

            <div className={styles.iconGroup} role="group" aria-label="Viewer and history controls">
              <ToolButton onClick={() => viewerRef.current?.zoomBy(1.35)} label="Zoom in" iconOnly>
                <Plus aria-hidden="true" />
              </ToolButton>
              <ToolButton
                onClick={() => viewerRef.current?.zoomBy(1 / 1.35)}
                label="Zoom out"
                iconOnly
              >
                <Minus aria-hidden="true" />
              </ToolButton>
              <ToolButton
                onClick={() => viewerRef.current?.resetToInitialView()}
                label="Reset view"
                iconOnly
              >
                <RotateCcw aria-hidden="true" />
              </ToolButton>
              <ToolButton
                onClick={undoAnnotations}
                label="Undo annotation change"
                disabled={!annotationHistory.length}
                iconOnly
              >
                <Undo2 aria-hidden="true" />
              </ToolButton>
              <ToolButton
                onClick={redoAnnotations}
                label="Redo annotation change"
                disabled={!annotationFuture.length}
                iconOnly
              >
                <Redo2 aria-hidden="true" />
              </ToolButton>
            </div>
          </div>

          <div className={styles.canvasShell} data-mode={drawMode}>
            <DeepZoomViewer
              ref={viewerRef}
              slide={document.slide}
              annotations={document.annotations}
              selectedAnnotationId={selectedId}
              previewedAnnotationId={previewedId}
              onImageHover={handleImageHover}
              onImageSelect={handleImageSelect}
              onViewportChange={setViewport}
              onStatusChange={setViewerStatus}
              interactionMode={drawMode === 'navigate' ? 'navigate' : 'draw-rectangle'}
              onDrawRectangle={handleRectangleDrawn}
            />
            <div className={styles.canvasStatus}>
              <span>{drawMode === 'navigate' ? 'Pan/select' : `Draw ${drawMode}`}</span>
              <span>{viewport.zoomRatio.toFixed(2)}×</span>
              <span>
                {document.slide.expectedDimensions.width} ×{' '}
                {document.slide.expectedDimensions.height}px
              </span>
            </div>
          </div>

          <div className={styles.viewerFooter}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={setInitialView}
              disabled={viewerStatus.phase !== 'ready'}
            >
              <Check aria-hidden="true" /> Use current view as starting crop
            </Button>
            <span>
              {drawMode === 'navigate'
                ? 'Drag to pan; click a region to edit it.'
                : 'Drag directly on the slide to create a rectangular annotation.'}
            </span>
          </div>
        </section>

        <aside className={styles.inspector} aria-label="Slide and region properties">
          <section className={styles.formSection}>
            <div className={styles.panelHeading}>
              <div>
                <span>Slide record</span>
                <h2>{document.title}</h2>
              </div>
              <Badge variant={statusVariant(document.workflowStatus)}>
                {document.workflowStatus}
              </Badge>
            </div>

            <Field label="Thinviewer or Invenio URL" htmlFor="socrates-descriptor">
              <div className={styles.inlineField}>
                <input
                  id="socrates-descriptor"
                  type="url"
                  value={descriptorInput}
                  aria-label="Thinviewer or Invenio URL"
                  onChange={(event) => {
                    setDescriptorInput(event.target.value)
                    setNotice(null)
                  }}
                  spellCheck={false}
                  aria-describedby="socrates-descriptor-help"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={loadDescriptor}
                  disabled={loadingDescriptor}
                >
                  {loadingDescriptor ? (
                    <LoaderCircle className={styles.spin} aria-hidden="true" />
                  ) : (
                    <ChevronDown aria-hidden="true" />
                  )}
                  Load
                </Button>
              </div>
              <small id="socrates-descriptor-help" className={styles.fieldHint}>
                Paste the normal NIO Thinviewer link or a raw Invenio DZI descriptor. Thinviewer
                crop coordinates are applied automatically.
              </small>
            </Field>

            <div className={styles.twoFields}>
              <Field label="Title" htmlFor="socrates-title">
                <input
                  id="socrates-title"
                  value={document.title}
                  onChange={(event) =>
                    setDirtyDocument((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </Field>
              <Field label="URL slug" htmlFor="socrates-slug">
                <input
                  id="socrates-slug"
                  value={document.slug}
                  onChange={(event) =>
                    setDirtyDocument((current) => ({
                      ...current,
                      slug: slugify(event.target.value),
                    }))
                  }
                />
              </Field>
            </div>

            <Field label="Attribution label" htmlFor="socrates-attribution-label">
              <input
                id="socrates-attribution-label"
                value={document.slide.attribution.label}
                onChange={(event) =>
                  updateSlideField('attribution', {
                    ...document.slide.attribution,
                    label: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="Attribution URL" htmlFor="socrates-attribution-url">
              <input
                id="socrates-attribution-url"
                type="url"
                value={document.slide.attribution.href}
                onChange={(event) =>
                  updateSlideField('attribution', {
                    ...document.slide.attribution,
                    href: event.target.value,
                  })
                }
              />
            </Field>
            <Field label="Content status" htmlFor="socrates-content-status">
              <input
                id="socrates-content-status"
                value={document.slide.contentStatus}
                onChange={(event) => updateSlideField('contentStatus', event.target.value)}
              />
            </Field>
          </section>

          <section className={styles.formSection}>
            <div className={styles.panelHeading}>
              <div>
                <span>Annotation set</span>
                <h2>Regions</h2>
              </div>
              <span className={styles.count}>{document.annotations.length}</span>
            </div>
            <div className={styles.regionList}>
              {document.annotations.map((annotation) => (
                <button
                  type="button"
                  key={annotation.id}
                  className={
                    annotation.id === selectedId ? styles.regionItemActive : styles.regionItem
                  }
                  onClick={() => setSelectedId(annotation.id)}
                  onFocus={() => setPreviewedId(annotation.id)}
                  onBlur={() => setPreviewedId(null)}
                >
                  <span>{annotation.label}</span>
                  <small>
                    {annotation.style}
                    {annotation.parentId ? ` · ${annotation.parentId}` : ''}
                  </small>
                </button>
              ))}
              {!document.annotations.length ? (
                <p className={styles.emptyRegions}>Choose Parent mode and drag on the slide.</p>
              ) : null}
            </div>
          </section>

          {selectedAnnotation && selectedBounds ? (
            <section className={styles.formSection} aria-label={`Edit ${selectedAnnotation.label}`}>
              <div className={styles.panelHeading}>
                <div>
                  <span>Selected region</span>
                  <h2>{selectedAnnotation.label}</h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={deleteSelectedAnnotation}
                  aria-label={`Delete ${selectedAnnotation.label}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>

              <div className={styles.twoFields}>
                <Field label="Label" htmlFor="region-label">
                  <input
                    id="region-label"
                    value={selectedAnnotation.label}
                    onChange={(event) =>
                      updateAnnotation(selectedAnnotation.id, (annotation) => ({
                        ...annotation,
                        label: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Type" htmlFor="region-style">
                  <select
                    id="region-style"
                    value={selectedAnnotation.style}
                    onChange={(event) => {
                      const style = event.target.value as DemoAnnotation['style']
                      updateAnnotation(selectedAnnotation.id, (annotation) => ({
                        ...annotation,
                        style,
                        parentId:
                          style === 'detail'
                            ? (annotation.parentId ??
                              parentAnnotations.find((candidate) => candidate.id !== annotation.id)
                                ?.id)
                            : undefined,
                        enterZoomRatio:
                          style === 'detail' ? Math.max(annotation.enterZoomRatio, 1.75) : 0,
                        exitZoomRatio:
                          style === 'detail' ? Math.max(annotation.exitZoomRatio, 1.55) : 0,
                      }))
                    }}
                  >
                    <option value="parent">Parent</option>
                    <option value="detail">Detail</option>
                  </select>
                </Field>
              </div>

              {selectedAnnotation.style === 'detail' ? (
                <Field label="Parent region" htmlFor="region-parent">
                  <select
                    id="region-parent"
                    value={selectedAnnotation.parentId ?? ''}
                    onChange={(event) =>
                      updateAnnotation(selectedAnnotation.id, (annotation) => ({
                        ...annotation,
                        parentId: event.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">Choose parent</option>
                    {parentAnnotations
                      .filter((parent) => parent.id !== selectedAnnotation.id)
                      .map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.label}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : null}

              <div className={styles.fourFields}>
                {(['x', 'y', 'width', 'height'] as const).map((field) => (
                  <Field key={field} label={field.toUpperCase()} htmlFor={`region-${field}`}>
                    <input
                      id={`region-${field}`}
                      type="number"
                      min={0}
                      step={1}
                      value={Math.round(selectedBounds[field] * 100) / 100}
                      onChange={(event) => updateSelectedBounds(field, Number(event.target.value))}
                    />
                  </Field>
                ))}
              </div>

              {selectedAnnotation.style === 'detail' ? (
                <div className={styles.twoFields}>
                  <Field label="Enter zoom" htmlFor="region-enter-zoom">
                    <input
                      id="region-enter-zoom"
                      type="number"
                      min={0}
                      step={0.05}
                      value={selectedAnnotation.enterZoomRatio}
                      onChange={(event) =>
                        updateAnnotation(selectedAnnotation.id, (annotation) => ({
                          ...annotation,
                          enterZoomRatio: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Exit zoom" htmlFor="region-exit-zoom">
                    <input
                      id="region-exit-zoom"
                      type="number"
                      min={0}
                      step={0.05}
                      value={selectedAnnotation.exitZoomRatio}
                      onChange={(event) =>
                        updateAnnotation(selectedAnnotation.id, (annotation) => ({
                          ...annotation,
                          exitZoomRatio: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                </div>
              ) : null}

              <Field label="Summary" htmlFor="region-summary">
                <textarea
                  id="region-summary"
                  rows={3}
                  value={selectedAnnotation.summary}
                  onChange={(event) =>
                    updateAnnotation(selectedAnnotation.id, (annotation) => ({
                      ...annotation,
                      summary: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Placeholder/review note" htmlFor="region-note">
                <textarea
                  id="region-note"
                  rows={2}
                  value={selectedAnnotation.placeholderNote}
                  onChange={(event) =>
                    updateAnnotation(selectedAnnotation.id, (annotation) => ({
                      ...annotation,
                      placeholderNote: event.target.value,
                    }))
                  }
                />
              </Field>
            </section>
          ) : null}
        </aside>
      </section>

      <footer className={styles.publishBar}>
        <div className={styles.publishState}>
          <Badge variant={dirty ? 'info' : 'success'}>{dirty ? 'Unsaved changes' : 'Saved'}</Badge>
          <span>Revision {document.revision}</span>
          {notice ? (
            <span
              className={styles[notice.tone]}
              role={notice.tone === 'error' ? 'alert' : 'status'}
            >
              {notice.message}
            </span>
          ) : null}
        </div>
        <div className={styles.publishActions}>
          {!isSandbox && document.publishedAt ? (
            <Button asChild variant="outline">
              <a
                href={`/${locale}/socrates-demo?slide=${encodeURIComponent(document.slug)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Eye aria-hidden="true" /> Open published slide
              </a>
            </Button>
          ) : null}
          {isSandbox ? (
            <>
              {document.recordId && ownedSandboxIds.has(document.recordId) ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void deleteCurrentSandboxDocument()}
                  disabled={saving}
                >
                  <Trash2 aria-hidden="true" /> Delete my draft
                </Button>
              ) : null}
              <Button type="button" onClick={() => void saveDocument('draft')} disabled={saving}>
                {saving ? (
                  <LoaderCircle className={styles.spin} aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                {document.recordId && !ownedSandboxIds.has(document.recordId)
                  ? 'Save my copy'
                  : 'Save to sandbox'}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveDocument('draft')}
                disabled={saving}
              >
                <Save aria-hidden="true" /> Save draft
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void saveDocument('review')}
                disabled={saving}
              >
                <Send aria-hidden="true" /> Submit review
              </Button>
              <Button
                type="button"
                onClick={() => void publishDocument()}
                disabled={saving || !access.canPublish || !document.recordId || dirty}
              >
                {saving ? (
                  <LoaderCircle className={styles.spin} aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                Publish
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label className={styles.field} htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function ToolButton({
  active = false,
  disabled = false,
  iconOnly = false,
  label,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  iconOnly?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`${styles.toolButton} ${active ? styles.toolButtonActive : ''} ${iconOnly ? styles.toolButtonIcon : ''}`}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
