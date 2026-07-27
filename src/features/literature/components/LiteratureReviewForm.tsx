'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import type { FlattenedLiteratureTopic } from '@/features/literature/config'
import { literatureTopicLabel } from '@/features/literature/domain/display'
import type { LiteratureArticleDetail } from '@/features/literature/server/types'
import type { ActiveLocale } from '@/i18n/locale'

interface LiteratureReviewFormProps {
  article: LiteratureArticleDetail
  locale: ActiveLocale
  topics: FlattenedLiteratureTopic[]
}

export function LiteratureReviewForm({ article, locale, topics }: LiteratureReviewFormProps) {
  const t = useTranslations('literature.admin.reviewForm')
  const workflowT = useTranslations('literature.workflow')
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [addTopicId, setAddTopicId] = useState('')
  const [addTopicState, setAddTopicState] = useState<'confirmed' | 'rejected'>('confirmed')

  const reviewTopics = useMemo(() => {
    const grouped = new Map<
      string,
      {
        topic: LiteratureArticleDetail['topics'][number]
        assignments: LiteratureArticleDetail['topics']
      }
    >()

    for (const topic of article.topics) {
      const existing = grouped.get(topic.id)
      if (existing) {
        existing.assignments.push(topic)
      } else {
        grouped.set(topic.id, { topic, assignments: [topic] })
      }
    }

    return [...grouped.values()]
  }, [article.topics])
  const currentTopicIds = useMemo(
    () => new Set(reviewTopics.map(({ topic }) => topic.id)),
    [reviewTopics],
  )

  async function submit(formData: FormData) {
    setSaving(true)
    setStatus(null)

    const topicDecisions = reviewTopics.flatMap(({ topic }) => {
      const value = formData.get(`topic:${topic.id}`)
      return value === 'confirmed' || value === 'rejected'
        ? [{ topicId: topic.id, state: value }]
        : []
    })
    if (addTopicId) {
      topicDecisions.push({ topicId: addTopicId, state: addTopicState })
    }

    const payload = {
      relevanceState: String(formData.get('relevanceState')),
      visibilityState: String(formData.get('visibilityState')),
      isLandmark: formData.get('isLandmark') === 'on',
      topicDecisions,
      reason: String(formData.get('reason') ?? '').trim() || undefined,
    }

    try {
      const response = await fetch(`/api/admin/literature/article/${article.pmid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error(t('saveError'))
      }
      setStatus(t('saved'))
      setAddTopicId('')
      router.refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form action={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          <span>{t('relevance')}</span>
          <select
            name="relevanceState"
            defaultValue={article.relevanceState}
            className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="unreviewed">{t('unreviewed')}</option>
            <option value="candidate">{t('candidate')}</option>
            <option value="included">{t('included')}</option>
            <option value="excluded">{t('excluded')}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{t('visibility')}</span>
          <select
            name="visibilityState"
            defaultValue={article.visibilityState}
            className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="draft">{t('draft')}</option>
            <option value="published">{t('published')}</option>
            <option value="hidden">{t('hidden')}</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="isLandmark"
          defaultChecked={article.isLandmark}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        {t('landmark')}
      </label>

      <fieldset className="space-y-3">
        <legend className="font-semibold">{t('topicDecisions')}</legend>
        {reviewTopics.length > 0 ? (
          <div className="grid gap-3">
            {reviewTopics.map(({ topic, assignments }) => (
              <label
                key={topic.id}
                className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_12rem] sm:items-center"
              >
                <span className="text-sm">
                  <span className="font-medium">{literatureTopicLabel(topic, locale)}</span>
                  {assignments.map((assignment) => (
                    <span
                      key={`${assignment.assignmentSource}:${assignment.modelOrRuleVersion}`}
                      className="ml-2 block text-xs text-muted-foreground sm:inline"
                    >
                      {workflowT(`assignmentSource.${assignment.assignmentSource}`)} ·{' '}
                      {workflowT(`assignmentState.${assignment.assignmentState}`)}
                      {assignment.confidence === null
                        ? ''
                        : ` · ${Math.round(assignment.confidence * 100)}%`}
                    </span>
                  ))}
                </span>
                <select
                  name={`topic:${topic.id}`}
                  defaultValue=""
                  className="h-9 rounded-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('leaveTopic')}</option>
                  <option value="confirmed">{t('confirmTopic')}</option>
                  <option value="rejected">{t('rejectTopic')}</option>
                </select>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noTopics')}</p>
        )}
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border/70 p-4">
        <legend className="px-1 font-semibold">{t('addTopic')}</legend>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="space-y-2 text-sm">
            <span className="sr-only">{t('addTopic')}</span>
            <select
              value={addTopicId}
              onChange={(event) => setAddTopicId(event.target.value)}
              className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('chooseTopic')}</option>
              {topics
                .filter((topic) => !currentTopicIds.has(topic.id))
                .map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.parentId ? '— ' : ''}
                    {literatureTopicLabel(topic, locale)}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="sr-only">{t('topicDecision')}</span>
            <select
              value={addTopicState}
              onChange={(event) =>
                setAddTopicState(event.target.value === 'rejected' ? 'rejected' : 'confirmed')
              }
              disabled={!addTopicId}
              className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="confirmed">{t('confirmTopic')}</option>
              <option value="rejected">{t('rejectTopic')}</option>
            </select>
          </label>
        </div>
      </fieldset>

      <label className="block space-y-2 text-sm font-medium">
        <span>{t('reason')}</span>
        <textarea
          name="reason"
          rows={4}
          maxLength={2000}
          defaultValue={article.curationReason ?? ''}
          placeholder={t('reasonPlaceholder')}
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="block text-xs font-normal text-muted-foreground">{t('reasonHelp')}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {status}
        </p>
      </div>
    </form>
  )
}
