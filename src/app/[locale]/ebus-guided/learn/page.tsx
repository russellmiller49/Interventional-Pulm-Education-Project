import { setRequestLocale } from 'next-intl/server'
import { CoursePage } from '@/features/ebus-guided/components/CoursePage'
import { LessonHost } from '@/features/ebus-guided/components/LessonHost'
import { lessonById } from '@/features/ebus-guided/content/curriculum'
import { chapterReview } from '@/features/ebus-guided/content/chapter-reviews'
import { ChapterReviewPage } from '@/features/ebus-guided/components/ChapterReviewPage'
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ section?: string | string[]; review?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const search = await searchParams
  const query = search.section,
    id = Array.isArray(query) ? query[0] : query,
    lesson = lessonById(id)
  // A chapter review: a few image questions at the end of a chapter.
  const reviewId = Array.isArray(search.review) ? search.review[0] : search.review
  if (!lesson && chapterReview(reviewId))
    return <ChapterReviewPage key={reviewId} chapterId={reviewId!} locale={locale} />
  return lesson ? (
    <LessonHost key={lesson.id} lesson={lesson} locale={locale} />
  ) : (
    <CoursePage locale={locale} mode="Learn" unknownSection={id} />
  )
}
