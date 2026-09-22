import { LESSONS } from '../data/lessons'
import { imagingLesson, peripheralImagingSectionIds, type ImagingSectionId } from './pathway'
import { imagingSectionItems, questionIdOf } from './stageItems'

/**
 * Where each section's closing question comes from.
 *
 * Report CW1 (fellow walkthrough, PDF p.6): every section ended on "Apply it to another situation",
 * and the question under that heading was, in seventeen of nineteen sections, an earlier section's
 * own check question reused word for word. The reuse is deliberate — the draft paired each section
 * with a retrieval item from earlier on the pathway (`stageItems.ts`) — but the heading called it a
 * new situation, and the first time a learner met it they thought it was a bug.
 *
 * This resolves, for every section, the question its transfer round reuses and the section that
 * question belongs to, so the step can be labelled as the optional review it is. Two facts are kept
 * apart: the section that *authored* the question (the lesson whose first check id it is), and the
 * sections that *rendered* it before this one. Seven sections show a newer interpretation check in
 * place of their authored first item (`INTERPRETATION_CHECKS`), so a question can belong to Section
 * 5 and yet be first met at the end of Section 6; the label must not claim Section 5 asked it.
 *
 * Nothing here changes an item, its id, its `transferVariantId`, its phase or what is stored: the
 * question is the same question, keyed the same way, under the same identity. Only the words around
 * it change, and only where the reuse is real. The two sections whose closing question is new to the
 * learner keep their original heading.
 */
export interface TransferOriginSection {
  readonly sectionId: ImagingSectionId
  /** One-based position on the pathway, for "Section 5". */
  readonly number: number
  readonly title: string
  readonly shortTitle: string
}

export interface TransferOrigin {
  readonly sectionId: ImagingSectionId
  readonly questionId: string
  /** The section the question belongs to: the lesson whose authored first check it is. */
  readonly origin: TransferOriginSection
  /** Earlier sections that rendered this exact question, in pathway order. Empty when this is the first. */
  readonly seenIn: readonly TransferOriginSection[]
}

function sectionRef(sectionId: ImagingSectionId): TransferOriginSection {
  const lesson = imagingLesson(sectionId)
  return {
    sectionId,
    number: peripheralImagingSectionIds.indexOf(sectionId) + 1,
    title: lesson.title,
    shortTitle: lesson.shortTitle,
  }
}

let cache: ReadonlyMap<ImagingSectionId, TransferOrigin | null> | null = null

function build(): ReadonlyMap<ImagingSectionId, TransferOrigin | null> {
  const map = new Map<ImagingSectionId, TransferOrigin | null>()
  const renderedIn = new Map<string, ImagingSectionId[]>()
  const note = (questionId: string, sectionId: ImagingSectionId) => {
    const list = renderedIn.get(questionId) ?? []
    if (!list.includes(sectionId)) list.push(sectionId)
    renderedIn.set(questionId, list)
  }
  for (const sectionId of peripheralImagingSectionIds) {
    const items = imagingSectionItems(sectionId)
    const questionId = questionIdOf(items.transfer.id)
    const seenIn = (renderedIn.get(questionId) ?? []).map(sectionRef)
    const authored = LESSONS.find((lesson) => lesson.checkIds[0] === questionId)
    const originId = (authored?.id as ImagingSectionId | undefined) ?? seenIn[0]?.sectionId ?? null
    map.set(
      sectionId,
      originId === null || originId === sectionId
        ? null
        : { sectionId, questionId, origin: sectionRef(originId), seenIn },
    )
    // What this section renders, for the sections after it.
    note(questionIdOf(items.prediction.id), sectionId)
    note(questionId, sectionId)
  }
  return map
}

/** The reuse behind a section's transfer round, or null when the question is new to the learner. */
export function transferOrigin(sectionId: ImagingSectionId): TransferOrigin | null {
  cache ??= build()
  return cache.get(sectionId) ?? null
}

/** The heading for a reused closing question. Step titles carry no digits; the short title names the section. */
export function transferReviewTitle(origin: TransferOrigin): string {
  return `Optional review · ${origin.origin.shortTitle}`
}

/**
 * The instruction under that heading: which section the question belongs to, whether the learner
 * has met it before, and that it is optional — answer, show the explanation, or continue.
 */
export function transferReviewInstruction(origin: TransferOrigin): string {
  const belongs = `Section ${origin.origin.number} (${origin.origin.title})`
  const first = origin.seenIn[0]
  const met =
    first === undefined
      ? `This question reviews ${belongs}.`
      : first.sectionId === origin.origin.sectionId
        ? `This is the check question from ${belongs}, asked again.`
        : `This question reviews ${belongs}; you first met it at the end of Section ${first.number} (${first.title}).`
  return `${met} It is optional review: answer it, show the explanation, or continue without answering.`
}

export function validateImagingTransferOrigins(): readonly string[] {
  const errors: string[] = []
  for (const sectionId of peripheralImagingSectionIds) {
    const origin = transferOrigin(sectionId)
    if (!origin) continue
    const where = `Transfer origin for ${sectionId}`
    if (origin.origin.sectionId === sectionId)
      errors.push(`${where} names the section itself as the origin.`)
    if (
      peripheralImagingSectionIds.indexOf(origin.origin.sectionId) >=
      peripheralImagingSectionIds.indexOf(sectionId)
    )
      errors.push(`${where} names a later section as the origin.`)
    for (const seen of origin.seenIn) {
      if (
        peripheralImagingSectionIds.indexOf(seen.sectionId) >=
        peripheralImagingSectionIds.indexOf(sectionId)
      )
        errors.push(`${where} says the question was seen in a later section.`)
    }
  }
  return errors
}

const transferOriginErrors = validateImagingTransferOrigins()
if (transferOriginErrors.length > 0) {
  throw new Error(`The transfer origins are invalid:\n${transferOriginErrors.join('\n')}`)
}
