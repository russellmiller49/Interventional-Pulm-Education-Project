import { setRequestLocale } from 'next-intl/server'
import { CoursePage } from '@/features/ebus-guided/components/CoursePage'
import { LessonHost } from '@/features/ebus-guided/components/LessonHost'
import { lessonById } from '@/features/ebus-guided/content/curriculum'
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ section?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const query = (await searchParams).section,
    id = Array.isArray(query) ? query[0] : query,
    lesson = lessonById(id)
  return lesson ? (
    <LessonHost key={lesson.id} lesson={lesson} locale={locale} />
  ) : (
    <CoursePage locale={locale} mode="Learn" unknownSection={id} />
  )
}
