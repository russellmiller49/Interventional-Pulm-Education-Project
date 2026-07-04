'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
  /** Optional airway id to open in the explorer from the feedback. */
  relatedNodeId?: string
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'rul-trifurcation',
    prompt: 'The right upper lobe bronchus classically divides into which three segments?',
    options: [
      'Apical (RB1), posterior (RB2), anterior (RB3)',
      'Lateral (RB4), medial (RB5), superior (RB6)',
      'Superior (RB6) and the four basal segments',
      'Apicoposterior (RB1+2) and anterior (RB3)',
    ],
    correctIndex: 0,
    explanation:
      'The RUL forms the classic three-segment trifurcation: apical (RB1), posterior (RB2), and anterior (RB3). The apicoposterior fusion (LB1+2) is a left-sided feature.',
    relatedNodeId: 'rul',
  },
  {
    id: 'aspiration-segment',
    prompt:
      'In a supine patient, aspirated material most often lodges in which segment — the most posterior of the lung?',
    options: [
      'Anterior basal segment (RB8)',
      'Superior segment of the lower lobe (RB6)',
      'Medial segment of the middle lobe (RB5)',
      'Apical segment (RB1)',
    ],
    correctIndex: 1,
    explanation:
      'RB6, the superior segment of the right lower lobe, is the most posterior segment and takes off just past the middle lobe origin — the classic destination for supine aspiration.',
    relatedNodeId: 'rb6',
  },
  {
    id: 'bi-division',
    prompt: 'The bronchus intermedius ends by dividing into which two structures?',
    options: [
      'Right upper lobe and bronchus intermedius',
      'Left upper lobe and left lower lobe',
      'Right middle lobe and right lower lobe',
      'Superior segment and basal trunk',
    ],
    correctIndex: 2,
    explanation:
      'Beyond the RUL takeoff, the RMB continues as the bronchus intermedius, which ends by dividing into the right middle lobe (anteriorly) and right lower lobe (posteriorly).',
    relatedNodeId: 'bronchus-intermedius',
  },
  {
    id: 'left-basal-fusion',
    prompt:
      'Why does the left lower lobe have only three basal segmental orifices instead of four?',
    options: [
      'The lateral and posterior basals fuse',
      'The medial (LB7) and anterior (LB8) basals fuse into LB7+8',
      'The superior segment counts as a basal segment',
      'The lingula replaces one basal segment',
    ],
    correctIndex: 1,
    explanation:
      'On the left, the medial basal (LB7) and anterior basal (LB8) share a common anteromedial stem (LB7+8), leaving three basal orifices versus four on the right.',
    relatedNodeId: 'lb7-8',
  },
  {
    id: 'lingula-analog',
    prompt: 'Which left-sided structure is the functional analog of the right middle lobe?',
    options: [
      'The superior segment (LB6)',
      'The upper division',
      'The lingula',
      'The anteromedial basal segment',
    ],
    correctIndex: 2,
    explanation:
      'The lingula is the tongue-shaped mirror of the right middle lobe, but it hangs off the left upper lobe (there is no separate middle lobe on the left) and divides into superior (LB4) and inferior (LB5) segments.',
    relatedNodeId: 'lingula',
  },
  {
    id: 'orientation',
    prompt:
      "With the scope in neutral orientation (anterior at 12 o'clock), the patient's right main bronchus opens toward which side of the video image?",
    options: ['The left', 'The right', "The top (12 o'clock)", "The bottom (6 o'clock)"],
    correctIndex: 0,
    explanation:
      "Looking down the trachea from the head of the bed, the patient's right is toward the left of the image — so the right main bronchus opens to your left and the left main bronchus to your right.",
    relatedNodeId: 'trachea',
  },
  {
    id: 'membranous-wall',
    prompt: 'Which landmark reliably identifies the posterior wall of the trachea?',
    options: [
      'The C-shaped cartilage rings',
      'The pulsating aortic arch',
      'The flat, vertically-striped membranous wall (trachealis)',
      'The main carina',
    ],
    correctIndex: 2,
    explanation:
      "The flat membranous wall with vertical trachealis muscle marks posterior (6 o'clock). Cartilage rings ridge the anterior and lateral walls. If you lose orientation, find the flat striped wall.",
    relatedNodeId: 'trachea',
  },
  {
    id: 'rul-origin',
    prompt:
      'Which lobar bronchus arises directly from a main bronchus rather than from the bronchus intermedius?',
    options: [
      'The right middle lobe',
      'The right upper lobe',
      'The right lower lobe',
      'The lingula',
    ],
    correctIndex: 1,
    explanation:
      'The right upper lobe is the only lobar bronchus that comes off the main bronchus itself, on the lateral wall, before the airway continues as the bronchus intermedius.',
    relatedNodeId: 'rmb',
  },
]

interface AirwayAnatomyQuizProps {
  onOpenStructure?: (id: string) => void
  className?: string
}

export function AirwayAnatomyQuiz({ onOpenStructure, className }: AirwayAnatomyQuizProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({})

  const answeredCount = Object.keys(answers).length
  const score = useMemo(
    () =>
      QUESTIONS.reduce(
        (total, question) => total + (answers[question.id] === question.correctIndex ? 1 : 0),
        0,
      ),
    [answers],
  )
  const allAnswered = answeredCount === QUESTIONS.length

  return (
    <div className={cn('space-y-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {allAnswered ? (
            <span className="font-semibold text-foreground">
              Score: {score} / {QUESTIONS.length}
            </span>
          ) : (
            <>
              Answered <span className="font-semibold text-foreground">{answeredCount}</span> of{' '}
              {QUESTIONS.length}
            </>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setAnswers({})}
          disabled={answeredCount === 0}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </Button>
      </div>

      <ol className="space-y-4">
        {QUESTIONS.map((question, questionIndex) => {
          const chosen = answers[question.id]
          const isAnswered = chosen !== undefined
          const isCorrect = chosen === question.correctIndex
          return (
            <li
              key={question.id}
              className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm"
            >
              <p className="mb-3 flex gap-2 text-sm font-semibold text-foreground">
                <span className="text-muted-foreground">{questionIndex + 1}.</span>
                {question.prompt}
              </p>
              <div className="grid gap-2">
                {question.options.map((option, optionIndex) => {
                  const isChosen = chosen === optionIndex
                  const isAnswer = optionIndex === question.correctIndex
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isAnswered}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))
                      }
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        !isAnswered &&
                          'border-border/70 hover:border-primary/50 hover:bg-primary/5',
                        isAnswered &&
                          isAnswer &&
                          'border-emerald-500/60 bg-emerald-500/10 text-foreground',
                        isAnswered &&
                          isChosen &&
                          !isAnswer &&
                          'border-rose-500/60 bg-rose-500/10 text-foreground',
                        isAnswered && !isChosen && !isAnswer && 'border-border/50 opacity-60',
                      )}
                    >
                      <span>{option}</span>
                      {isAnswered && isAnswer && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      )}
                      {isAnswered && isChosen && !isAnswer && (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
              {isAnswered && (
                <div
                  className={cn(
                    'mt-3 rounded-lg border px-3 py-2 text-xs leading-5',
                    isCorrect
                      ? 'border-emerald-500/40 bg-emerald-500/5 text-muted-foreground'
                      : 'border-amber-500/40 bg-amber-500/5 text-muted-foreground',
                  )}
                >
                  <span className="font-semibold text-foreground">
                    {isCorrect ? 'Correct. ' : 'Not quite. '}
                  </span>
                  {question.explanation}
                  {question.relatedNodeId && onOpenStructure && (
                    <button
                      type="button"
                      onClick={() => onOpenStructure(question.relatedNodeId!)}
                      className="ml-1 font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Open in explorer →
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
