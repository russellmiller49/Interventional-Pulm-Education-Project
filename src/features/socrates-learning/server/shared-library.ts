import 'server-only'
import { z } from 'zod'
import { getSocratesEditorSession } from '@/features/socrates-builder/server/access'
import { SocratesAccessError, studyDatabase } from '@/features/socrates-study/server/service'
import { sharedSlideSchema, type SharedSlide } from '../shared-library'
import { socratesSlideDocumentSchema } from '@/features/socrates-builder/schema'

export async function sharedLibrarySession() {
  const session = await getSocratesEditorSession()
  if (
    !session.user ||
    session.user.is_anonymous ||
    !session.user.email_confirmed_at ||
    !session.canEdit
  )
    throw new SocratesAccessError('Sign in with a verified SOCRATES editor account.', 403)
  return session
}
export async function listSharedSlides(): Promise<SharedSlide[]> {
  const { supabase } = await sharedLibrarySession()
  const { data, error } = await supabase.rpc('list_socrates_library_slides')
  if (error)
    throw new SocratesAccessError(
      'Shared library unavailable. Check the connection and database migration.',
      503,
    )
  return z.array(sharedSlideSchema).parse(data)
}
export async function libraryReleases(id?: string) {
  const { data, error } = await studyDatabase().rpc('socrates_library_releases', {
    requested_id: id ?? null,
  })
  if (error) throw new SocratesAccessError('Published modules are temporarily unavailable.', 503)
  return z
    .array(
      z.object({
        id: z.string().uuid(),
        assignment: z.enum(['teaching', 'testing']),
        publishedAt: z.string(),
        document: socratesSlideDocumentSchema,
      }),
    )
    .parse(data)
}
export async function libraryImageDocument(id: string, revision: number) {
  const released = (await libraryReleases(id)).find(
    (item) => item.id === id && item.document.revision === revision,
  )
  if (!released) throw new SocratesAccessError('Published slide unavailable.', 404)
  return released
}
