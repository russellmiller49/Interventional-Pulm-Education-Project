import { completeLessons } from './complete'

/**
 * Lesson 24's troubleshooting questions laid out as a flow (EBUS-PRE-REVIEW-04, L24-2).
 *
 * Everything here is read out of the lesson itself, by reference, so the flow cannot drift from
 * the teaching: the five questions are the question sentences of the first teaching paragraph, in
 * its order; a row's example is the lesson's own matching pair for that failure, attached only
 * where the lesson's text names the same failure (coupling in the worked example, framing in the
 * first check's rationale, the lost tip in the pair itself). Two questions have no pairing in the
 * lesson and the flow says so rather than supplying one. No priority beyond the lesson's own
 * order is claimed, and nothing here is a clinical algorithm.
 */
const lesson = completeLessons.find((entry) => entry.id === 'difficult-acquisition')!
const pairs = lesson.matching!.pairs
const questions = lesson.paragraphs[0].match(/Is [^?]*\?/g) ?? []
const sentences = (text: string) => text.match(/[^.]+\./g)?.map((part) => part.trim()) ?? []

export interface TroubleshootingStep {
  question: string
  example?: { observed: string; response: string }
}

const exampleFor: (number | undefined)[] = [undefined, 0, 1, undefined, 2]
export const TROUBLESHOOTING_STEPS: TroubleshootingStep[] = questions.map((question, index) => {
  const pair = exampleFor[index] === undefined ? undefined : pairs[exampleFor[index]!]
  return pair
    ? { question, example: { observed: pair.cue, response: pair.response } }
    : { question }
})
/** The paragraph's own instruction after the questions. */
export const TROUBLESHOOTING_RULE = lesson.paragraphs[0].split('?').at(-1)!.trim()
/** What the lesson says when a correction does not resolve the problem. */
export const TROUBLESHOOTING_PERSISTENT = {
  text: sentences(lesson.paragraphs[1])[0],
  example: { observed: pairs[3].cue, response: pairs[3].response },
}
/** The first sentence of the patient-safety paragraph, which stays whole in the lesson text. */
export const TROUBLESHOOTING_PATIENT = sentences(lesson.paragraphs[2])[0]
