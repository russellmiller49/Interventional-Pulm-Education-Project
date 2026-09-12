/** Inventory existing media for faculty review without copying source metadata or changing assets. */
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'
import { createRequire } from 'node:module'
const { SCOPE_PHOTO_IDS, STILL_STRUCTURE_IDS, CT_STRUCTURE_IDS } = createRequire(import.meta.url)(
  '../../src/features/bronchoscopy-foundations/content/media',
) as typeof import('../../src/features/bronchoscopy-foundations/content/media')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const destination = path.join(root, 'docs/bronchoscopy-foundations/media-register.json')
const read = async (url: string) =>
  JSON.parse(await readFile(path.join(root, 'public', url), 'utf8'))
const photoManifest = '/intro-bronchoscopy/scope-anatomy/scope-photo-atlas.json'
const stillManifest = '/airway-lesson/airway-quiz-frames.json'
const ctManifest = '/airway-lesson/airway-survey-ct.json'
const [photos, stills, ct] = await Promise.all([
  read(photoManifest),
  read(stillManifest),
  read(ctManifest),
])
const pending = []
for (const id of SCOPE_PHOTO_IDS)
  pending.push({
    id,
    kind: 'device-photograph',
    url: photos.images.find((image: { id: string }) => image.id === id).src,
    sourceManifest: photoManifest,
    usedInCurrentStage: true,
    origin:
      'Existing repository bronchoscope photograph and annotations; source rights need owner confirmation',
  })
for (const id of STILL_STRUCTURE_IDS)
  pending.push({
    id,
    kind: 'endoscopic-still',
    url: stills.structures[id].img,
    sourceManifest: stillManifest,
    usedInCurrentStage: true,
    origin:
      'Frame from the existing annotated normal airway survey; anatomy, orientation and source rights need review',
  })
for (const id of CT_STRUCTURE_IDS)
  for (const plane of ['axial', 'coronal'])
    pending.push({
      id: id + '-' + plane,
      kind: 'ct-correlation',
      url: ct.structures[id][plane],
      sourceManifest: ctManifest,
      usedInCurrentStage: true,
      origin:
        'Existing case-001 CT correlation render; orientation and de-identification confirmation pending',
    })
pending.push({
  id: 'annotated-normal-survey',
  kind: 'survey-video',
  url: '/airway-lesson/airway-survey-cropped.mp4',
  sourceManifest: '/airway-lesson/airway-survey-overlays.json',
  usedInCurrentStage: false,
  origin:
    'Existing annotated airway survey; the current foundations stage uses its stills, not video playback',
})
const files = await Promise.all(
  pending.map(async (entry) => {
    if (!entry.url.startsWith('/') || entry.url.includes('..'))
      throw new Error('Invalid public media URL')
    const bytes = await readFile(path.join(root, 'public', entry.url))
    return {
      ...entry,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      creatorOrRightsholder: null,
      licenseOrPermission: null,
      deidentificationStatus: 'pending-owner-confirmation',
      clinicalReviewer: null,
      reviewDate: null,
      clinicalReviewStatus: 'pending',
      publicationPermitted: null,
    }
  }),
)
const result = {
  schema: 'bronchoscopy_foundations_existing_media_review/v1',
  status: 'pending-owner-and-faculty-review',
  anatomyManifest: 'public/bronchoscopy-foundations/anatomy/manifest.json',
  note: 'Technical availability is not rights clearance or clinical approval. Transcript timestamps are separate approximate text citations; no lecture recording is claimed to have been reviewed.',
  files,
}
const options = await prettier.resolveConfig(destination)
const formatted = await prettier.format(JSON.stringify(result), { ...options, parser: 'json' })
if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8')) !== formatted)
    throw new Error('Media review register is stale')
} else await writeFile(destination, formatted)
console.log('Existing-media review register: ' + files.length + ' files, all pending review.')
