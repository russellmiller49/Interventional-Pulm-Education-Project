import { claimRegister, type Claim } from '../content/claimRegister'
import {
  deviceDefinitions,
  type DeviceDefinition,
  type DeviceFact,
  type DeviceForm,
} from '../content/deviceDefinitions'
import type { ReviewDecision } from '../content/reviewRecords'
import { citationLocator, doiUrl, sourceRegister } from '../content/sources'

/**
 * Readable views of the registers the course reads. The JSON files are the record; these pages
 * are printed from them by `scripts/medical-thoracoscopy/render-registers.ts`, and a test fails
 * when a page and its register disagree. Do not edit the pages by hand.
 */
const GENERATED =
  '_Printed from the register by `scripts/medical-thoracoscopy/render-registers.ts`. Do not edit by hand._'

/** A link the formatter leaves alone: an address with brackets in it is wrapped in `<>`. */
function link(text: string, url: string): string {
  return /[()\s]/.test(url) ? `[${text}](<${url}>)` : `[${text}](${url})`
}

function doiLink(doi: string): string {
  return link(`doi:${doi}`, doiUrl(doi))
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
}

function table(headings: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]) => `| ${cells.map(cell).join(' | ')} |`
  return [line(headings), line(headings.map(() => '---')), ...rows.map(line)].join('\n')
}

function decisionWords(decision: ReviewDecision): string {
  if (decision.decision === 'NOT REVIEWED') return 'NOT REVIEWED'
  return `${decision.decision}, ${decision.reviewer} (${decision.role}), ${decision.date}, revision ${decision.reviewedRevision}`
}

function withUnit(value: number, unit: 'mm' | 'deg' | null): string {
  if (unit === 'deg') return `${value}°`
  return unit === null ? String(value) : `${value} ${unit}`
}

function factValue(entry: DeviceFact): string {
  if (entry.value === null) return 'Not known'
  if (typeof entry.value === 'number') {
    const tolerance =
      entry.tolerance === undefined ? '' : ` ± ${withUnit(entry.tolerance, entry.unit)}`
    return `${withUnit(entry.value, entry.unit)}${tolerance}`
  }
  return entry.value
}

function factSources(entry: DeviceFact | DeviceForm): string {
  if (entry.sources.length === 0) return 'None'
  const read = entry.sources.map((source) => `${source.document}, ${source.locator}`).join('; ')
  return entry.measurement ? `${read} (${entry.measurement.join(', ')})` : read
}

/** `baseAtMm: 258` reads "base at 258 mm"; `elevationDeg: 12` reads "elevation 12°". */
function parameterWords(name: string, value: number | string): string {
  const unit = name.endsWith('Mm') ? 'mm' : name.endsWith('Deg') ? 'deg' : null
  const stem = unit === null ? name : name.slice(0, -(unit === 'mm' ? 2 : 3))
  const words = stem.replace(/([A-Z])/g, ' $1').toLowerCase()
  return `${words} ${typeof value === 'number' ? withUnit(value, unit) : value}`
}

function formValue(entry: DeviceForm): string {
  if (entry.kind === 'parameters') {
    return Object.entries(entry.parameters ?? {})
      .map(([name, value]) => parameterWords(name, value))
      .join('; ')
  }
  const points = entry.points ?? []
  const first = Math.min(...points.map(([along]) => along))
  const last = Math.max(...points.map(([along]) => along))
  const tolerance = entry.tolerance === undefined ? '' : `, ± ${entry.tolerance} mm`
  return `${points.length} points of ${entry.axes?.[1]} against ${entry.axes?.[0]}, ${first} to ${last} mm${tolerance}`
}

function deviceSection(device: DeviceDefinition): string {
  const numbers =
    device.productNumbers.length === 0
      ? 'None'
      : device.productNumbers
          .map((entry) => `\`${entry.number}\` (${entry.what}; ${entry.market})`)
          .join(', ')
  const modelled = device.modelled
    ? device.inPrototype
      ? 'Modelled, and loaded by the week-4 pages'
      : 'Modelled'
    : 'Not modelled in the first round'

  const standard =
    device.standard === 'full'
      ? ' Held to the full standard.'
      : device.standard === 'draft'
        ? ' Draft standard, for review.'
        : ''
  const forms =
    device.forms.length === 0
      ? []
      : [
          '',
          'Forms:',
          '',
          table(
            ['Item', 'Form', 'Kind of claim', 'Status', 'Read in', 'Fact check', 'Note'],
            device.forms.map((entry) => [
              entry.label,
              formValue(entry),
              entry.category,
              entry.status,
              factSources(entry),
              decisionWords(entry.factCheck),
              entry.note ?? '',
            ]),
          ),
        ]

  return [
    `### ${device.name}`,
    '',
    `Product numbers: ${numbers}`,
    '',
    `${modelled}.${standard}`,
    '',
    table(
      ['Item', 'Value', 'Kind of claim', 'Status', 'Read in', 'Fact check', 'Note'],
      device.facts.map((entry) => [
        entry.label,
        factValue(entry),
        entry.category,
        entry.status,
        factSources(entry),
        decisionWords(entry.factCheck),
        entry.note ?? '',
      ]),
    ),
    ...forms,
  ].join('\n')
}

export function renderDeviceRegister(): string {
  const definitions = deviceDefinitions

  return [
    '# Medical Thoracoscopy — device register',
    '',
    GENERATED,
    '',
    definitions.statement,
    '',
    `Intended market: ${definitions.intendedMarket.value} (${definitions.intendedMarket.status}). ${definitions.intendedMarket.note}`,
    '',
    `Every model is labelled "${definitions.labelUntilCad}" until it is built from manufacturer CAD.`,
    '',
    "A value followed by ± was measured from the manufacturer's reference frames (`S-FRAMES`); the names in brackets are its entries in `content/data/reference-measurements.json`, which records how each was measured and how its tolerance was found. A measured value is not a device fact.",
    '',
    '## Documents',
    '',
    table(
      ['Id', 'Document', 'Number', 'Publisher', 'Market', 'Date', 'Basis for the date', 'Pages'],
      definitions.documents.map((document) => [
        document.id,
        document.title,
        document.documentNumber,
        document.publisher,
        document.market,
        document.documentDate,
        document.dateBasis,
        document.pages === null ? 'Not applicable' : String(document.pages),
      ]),
    ),
    '',
    '## Devices',
    '',
    definitions.devices.map(deviceSection).join('\n\n'),
    '',
    '## Fit',
    '',
    'A dimensional comparison is shown beside each entry. It is never the basis for the status.',
    '',
    table(
      [
        'Combination',
        'Market',
        'Status',
        'Basis',
        'Read in',
        'Dimensional comparison',
        'Fact check',
      ],
      definitions.fit.map((entry) => [
        entry.parts.join(' + '),
        entry.market,
        entry.status,
        entry.basis,
        entry.sources.length === 0
          ? 'None'
          : entry.sources.map((source) => `${source.document}, ${source.locator}`).join('; '),
        entry.dimensionalComparison ?? 'None',
        decisionWords(entry.factCheck),
      ]),
    ),
    '',
    '## Needed and not known',
    '',
    table(
      ['Device', 'Item', 'Kind of claim', 'Needed by', 'Note'],
      definitions.devices.flatMap((device) =>
        device.facts
          .filter((entry) => entry.value === null)
          .map((entry) => [
            device.name,
            entry.label,
            entry.category,
            (entry.neededBy ?? []).join(', '),
            entry.note ?? '',
          ]),
      ),
    ),
    '',
    'This does not change publication status or constitute clinical approval.',
    '',
  ].join('\n')
}

function claimSection(claim: Claim): string {
  const sources =
    claim.sources.length === 0
      ? (claim.sourceNote ?? 'None')
      : claim.sources
          .map(
            (source) =>
              `${source.source}, ${source.locator} (${source.read} read): ${source.supports}`,
          )
          .join('; ')

  return [
    `### ${claim.id}, revision ${claim.revision}`,
    '',
    `> ${claim.assertion}`,
    '',
    table(
      ['Field', 'Value'],
      [
        ['Kind of claim', claim.category],
        ['Review lane', claim.lane],
        ['Context', claim.context],
        ['Sources', sources],
        ...(claim.sources.length > 0 && claim.sourceNote
          ? [['Note on the sources', claim.sourceNote]]
          : []),
        [
          'Where it is shown',
          claim.surfaces
            .map((surface) => `${surface.kind} ${surface.id} (${surface.state})`)
            .join('; '),
        ],
        ['Rules that depend on it', claim.dependentRules.join(' ')],
        ['Limitations', claim.limitations],
        ['Status', claim.status],
        [
          'Shown before review',
          claim.shownBeforeReview.allowed
            ? `Yes, labelled "${claim.shownBeforeReview.learnerLabel}". ${claim.shownBeforeReview.basis}`
            : 'No',
        ],
        ['Blocks publication', claim.blocksPublication ? 'Yes' : 'No'],
        ['Decision', decisionWords(claim.decision)],
      ],
    ),
  ].join('\n')
}

export function renderClaimReviewQueue(): string {
  return [
    '# Medical Thoracoscopy — claim review queue',
    '',
    GENERATED,
    '',
    claimRegister.statement,
    '',
    '## How to record a decision',
    '',
    'Edit the claim in `src/features/medical-thoracoscopy/content/data/claim-register.json`. Replace NOT REVIEWED with your own decision, and give your name, your role, the date you decided and the commit you reviewed. A decision covers that claim at that revision and the surfaces listed for it. A later change to the wording or to the behaviour that depends on it reopens the claim.',
    '',
    `## Claims (${claimRegister.claims.length})`,
    '',
    claimRegister.claims.map(claimSection).join('\n\n'),
    '',
    'This does not change publication status or constitute clinical approval.',
    '',
  ].join('\n')
}

export function renderSourceRegister(): string {
  return [
    '# Medical Thoracoscopy — source register',
    '',
    GENERATED,
    '',
    sourceRegister.statement,
    '',
    '## Literature',
    '',
    table(
      ['Id', 'Kind', 'Citation', 'Identifiers', 'Checked', 'Read', 'What it does not cover'],
      sourceRegister.sources.map((source) => [
        source.id,
        source.class,
        `${source.authors} ${source.title}. ${source.journal}. ${source.year};${citationLocator(source)}.`,
        `${doiLink(source.doi)}; PMID ${source.pmid}`,
        `${source.checked.on}, ${source.checked.against}`,
        source.checked.readParts
          ? `${source.checked.read}, in part: ${source.checked.readParts}`
          : source.checked.read,
        source.limits,
      ]),
    ),
    '',
    '## Datasets',
    '',
    table(
      ['Id', 'Dataset', 'Identifiers', 'Licence', 'Described in', 'Use', 'Identity'],
      sourceRegister.datasets.map((dataset) => [
        dataset.id,
        `${dataset.creators}. ${dataset.title}. ${dataset.publisher}; ${dataset.published}, ${dataset.version}.`,
        doiLink(dataset.doi),
        `${dataset.licence} (${dataset.licenceShort})`,
        `${dataset.describedIn.authors} ${dataset.describedIn.title}. ${dataset.describedIn.journal}. ${dataset.describedIn.year};${dataset.describedIn.volume}(${dataset.describedIn.issue}):${dataset.describedIn.pages}. ${doiLink(dataset.describedIn.doi)}`,
        dataset.use,
        `${dataset.identity.status}. ${dataset.identity.note}`,
      ]),
    ),
    '',
    '## Manufacturer documents',
    '',
    'Listed in the [device register](device-register.md).',
    '',
    'This does not change publication status or constitute clinical approval.',
    '',
  ].join('\n')
}

export const REGISTER_PAGES = [
  { path: 'docs/medical-thoracoscopy/registers/device-register.md', render: renderDeviceRegister },
  {
    path: 'docs/medical-thoracoscopy/registers/claim-review-queue.md',
    render: renderClaimReviewQueue,
  },
  { path: 'docs/medical-thoracoscopy/registers/source-register.md', render: renderSourceRegister },
] as const

/**
 * A page with its table padding removed, so a page that a formatter has re-aligned still equals
 * the page that was printed.
 */
export function normalisePage(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trimEnd()
      if (!trimmed.startsWith('|')) return trimmed
      const cells = trimmed
        .slice(1, trimmed.endsWith('|') ? -1 : undefined)
        .split(/(?<!\\)\|/)
        .map((entry) => entry.trim())
        .map((entry) => (/^:?-{3,}:?$/.test(entry) ? '---' : entry))
      return `| ${cells.join(' | ')} |`
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
