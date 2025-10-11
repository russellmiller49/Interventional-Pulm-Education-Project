'use client'

import { useEffect, useMemo, useState } from 'react'
import { MagnifyingGlassIcon, RowsIcon } from '@radix-ui/react-icons'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { BoardReviewSection } from '@/lib/board-review-loader'
import { Quiz, type QuizQuestion } from '@/components/training/Quiz'

import { MarkdownContent } from './MarkdownContent'

interface BoardReviewSectionsProps {
  sections: BoardReviewSection[]
}

interface ParsedQuestionBank {
  intro?: string
  questions: QuizQuestion[]
}

export function BoardReviewSections({ sections }: BoardReviewSectionsProps) {
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState<string[]>([])

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return sections
    }

    return sections.filter((section) => {
      const haystack = `${section.title} ${section.content}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [query, sections])

  useEffect(() => {
    setOpenSections(filteredSections.slice(0, 3).map((section) => section.id))
  }, [filteredSections])

  const allExpanded = filteredSections.length > 0 && openSections.length === filteredSections.length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Interactive chapter</p>
          <p className="text-xs text-muted-foreground">
            Expand sections to review focused notes. Search filters headings and body copy in real
            time.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search within this chapter"
            leadingIcon={<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />}
            className="text-sm"
            aria-label="Search within this chapter"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('gap-2 whitespace-nowrap', allExpanded && 'bg-primary/10 text-primary')}
            onClick={() =>
              setOpenSections(allExpanded ? [] : filteredSections.map((section) => section.id))
            }
          >
            <RowsIcon className="h-4 w-4" aria-hidden />
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </Button>
        </div>
      </div>

      {filteredSections.length ? (
        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={(values) => setOpenSections(values as string[])}
          className="space-y-3"
        >
          {filteredSections.map((section) => {
            const quizData = parseQuestionBank(section.content)
            const showQuiz =
              quizData.questions.length > 0 && /question bank/i.test(section.title ?? '')

            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="overflow-hidden rounded-3xl border border-border/70 bg-card/70"
              >
                <AccordionTrigger className="px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:no-underline">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="border-t border-border/60 bg-background/80 px-5 py-5">
                  {showQuiz ? (
                    <div className="space-y-6">
                      {quizData.intro ? <MarkdownContent content={quizData.intro} /> : null}
                      <Quiz title={section.title} questions={quizData.questions} />
                    </div>
                  ) : (
                    <MarkdownContent content={section.content} />
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      ) : (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/60 p-10 text-center text-sm text-muted-foreground">
          No sections matched that query. Try a different term.
        </div>
      )}
    </div>
  )
}

function parseQuestionBank(content: string): ParsedQuestionBank {
  if (!/Answer:/i.test(content)) {
    return { questions: [] }
  }

  const lines = content.split('\n')
  const questions: QuizQuestion[] = []
  const introLines: string[] = []

  let questionLines: string[] = []
  let options: string[] = []
  let explanationLines: string[] = []
  let answerLetter: string | null = null
  let collectingExplanation = false
  let hasStarted = false

  const flush = () => {
    if (!questionLines.length || !options.length || answerLetter === null) {
      questionLines = []
      options = []
      explanationLines = []
      answerLetter = null
      collectingExplanation = false
      return
    }

    const prompt = questionLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^\d+\.\s*/, '')
      .trim()

    const answerIndex = letterToIndex(answerLetter)

    if (answerIndex === -1 || answerIndex >= options.length) {
      questionLines = []
      options = []
      explanationLines = []
      answerLetter = null
      collectingExplanation = false
      return
    }

    const explanation = explanationLines.join(' ').replace(/\s+/g, ' ').trim()

    questions.push({
      prompt,
      options: options.map((option) => option.trim()),
      answerIndex,
      explanation,
    })

    questionLines = []
    options = []
    explanationLines = []
    answerLetter = null
    collectingExplanation = false
  }

  const optionRegex = /^[A-E]\.\s*(.*)$/
  const answerRegex = /^Answer:\s*([A-E])\.?\s*(.*)$/i

  for (let i = 0; i <= lines.length; i++) {
    const line = i === lines.length ? '' : lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      if (collectingExplanation || questionLines.length || options.length) {
        flush()
        hasStarted = true
      } else if (!hasStarted && line) {
        introLines.push(line)
      }
      continue
    }

    const answerMatch = trimmed.match(answerRegex)
    if (answerMatch) {
      answerLetter = answerMatch[1].toUpperCase()
      const rest = answerMatch[2]?.trim() ?? ''
      const cleaned = rest.replace(/^Explanation:\s*/i, '')
      if (cleaned) {
        explanationLines.push(cleaned)
      }
      collectingExplanation = true
      hasStarted = true
      continue
    }

    if (collectingExplanation) {
      explanationLines.push(trimmed)
      continue
    }

    const optionMatch = trimmed.match(optionRegex)
    if (optionMatch) {
      options.push(optionMatch[1])
      hasStarted = true
      continue
    }

    if (!hasStarted && !options.length && !answerLetter) {
      introLines.push(line)
    } else {
      questionLines.push(trimmed)
      hasStarted = true
    }
  }

  return {
    intro: introLines.join('\n').trim() || undefined,
    questions,
  }
}

function letterToIndex(letter: string | null): number {
  if (!letter) {
    return -1
  }

  const index = letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
  return index >= 0 ? index : -1
}
