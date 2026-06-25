import { handoffMessageIds } from './handoff-message-ids'

export type HandoffRawTranslator = {
  (key: string, values?: Record<string, unknown>): string
  raw?: (key: string) => unknown
}

function normalizeLookupText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function exactTranslation(t: HandoffRawTranslator, value: string) {
  const messageId = handoffMessageIds[normalizeLookupText(value)]
  if (!messageId) {
    return value
  }

  const translated = t.raw?.(messageId)
  return typeof translated === 'string' ? translated : value
}

type DynamicMatch = {
  key: string
  values: Record<string, unknown>
}

function matchDynamicText(t: HandoffRawTranslator, value: string): DynamicMatch | null {
  let match: RegExpMatchArray | null

  if ((match = value.match(/^Show knobology for (.+)$/))) {
    return {
      key: 'd_show_knobology_for',
      values: { label: exactTranslation(t, match[1]) },
    }
  }
  if ((match = value.match(/^Select (.+)$/))) {
    return {
      key: 'd_select_label',
      values: { label: exactTranslation(t, match[1]) },
    }
  }
  if ((match = value.match(/^Resize (.+)$/))) {
    return {
      key: 'd_resize_label',
      values: { label: exactTranslation(t, match[1]) },
    }
  }
  if ((match = value.match(/^Inspect (.+): (.+)$/))) {
    return {
      key: 'd_inspect_annotation',
      values: {
        label: exactTranslation(t, match[1]),
        cellType: exactTranslation(t, match[2]),
      },
    }
  }
  if ((match = value.match(/^Open publication for (.+) in a new tab$/))) {
    return { key: 'd_open_publication', values: { title: match[1] } }
  }
  if ((match = value.match(/^Pause (.+)$/))) {
    return { key: 'd_pause_title', values: { title: match[1] } }
  }
  if ((match = value.match(/^Play (.+)$/))) {
    return { key: 'd_play_title', values: { title: match[1] } }
  }
  if ((match = value.match(/^Playback position for (.+)$/))) {
    return { key: 'd_playback_position', values: { title: match[1] } }
  }
  if ((match = value.match(/^Seek controls for (.+)$/))) {
    return { key: 'd_seek_controls', values: { title: match[1] } }
  }
  if ((match = value.match(/^(.+): ([0-9.]+) out of 5 stars$/))) {
    return {
      key: 'd_rating_out_of_five',
      values: { label: exactTranslation(t, match[1]), rating: match[2] },
    }
  }
  if ((match = value.match(/^(Rewind|Forward) ([0-9.]+) seconds for (.+)$/))) {
    return {
      key: 'd_seek_seconds',
      values: {
        direction: exactTranslation(t, match[1]),
        amount: match[2],
        title: match[3],
      },
    }
  }
  if ((match = value.match(/^(\d+)-frame blend$/))) {
    return { key: 'd_frame_blend', values: { count: match[1] } }
  }
  if ((match = value.match(/^Real-time volumetric DRR at RAO\/LAO (.+) cranial\/caudal (.+)$/))) {
    return {
      key: 'd_realtime_drr',
      values: { rao: match[1], cranial: match[2] },
    }
  }
  if (
    (match = value.match(
      /^Interpolated simulated fluoro near (.+) RAO\/LAO and (.+) cranial\/caudal$/,
    ))
  ) {
    return {
      key: 'd_interpolated_fluoro',
      values: { rao: match[1], cranial: match[2] },
    }
  }
  if (
    (match = value.match(
      /^SlicerHeart reference uses exported detector geometry(, SID .+ mm)?\. Mesh overlay is hidden because this frame already contains Slicer's airway render\.$/,
    ))
  ) {
    return { key: 'd_slicer_reference', values: { sid: match[1] ?? '' } }
  }
  if ((match = value.match(/^Continuous atlas blend: (.+)\. Nearest delta (.+) \/ (.+) deg\.$/))) {
    return {
      key: 'd_continuous_atlas',
      values: {
        description: exactTranslation(t, match[1]),
        rao: match[2],
        cranial: match[3],
      },
    }
  }
  if ((match = value.match(/^Slicer export L\/P\/C (.+) \/ (.+) \/ (.+) deg\.$/))) {
    return {
      key: 'd_slicer_export',
      values: { l: match[1], p: match[2], c: match[3] },
    }
  }
  if ((match = value.match(/^Continuous blend delta (.+) \/ (.+) deg\.$/))) {
    return {
      key: 'd_continuous_delta',
      values: { rao: match[1], cranial: match[2] },
    }
  }
  if ((match = value.match(/^([A-Za-z]+) CT slice (\d+)$/))) {
    return { key: 'd_ct_slice', values: { axis: match[1], index: match[2] } }
  }
  if ((match = value.match(/^(\d+) edges$/))) {
    return { key: 'd_edge_count', values: { count: match[1] } }
  }
  if ((match = value.match(/^(\d+) pts \| (.+) mm$/))) {
    return {
      key: 'd_points_length',
      values: { count: match[1], length: match[2] },
    }
  }
  if ((match = value.match(/^Completing profile for (.+)\.$/))) {
    return { key: 'd_completing_profile', values: { email: match[1] } }
  }
  if ((match = value.match(/^Steer (.+) degrees clockwise from up$/))) {
    return { key: 'd_steer_clockwise', values: { angle: match[1] } }
  }
  if ((match = value.match(/^Align scope toward (.+)$/))) {
    return { key: 'd_align_scope', values: { abbr: match[1] } }
  }
  if ((match = value.match(/^(.+) chapter content$/))) {
    return {
      key: 'd_chapter_content',
      values: { title: exactTranslation(t, match[1]) },
    }
  }
  if ((match = value.match(/^Cross-section for (.+) and (.+)$/))) {
    return {
      key: 'd_cross_section',
      values: { scope: match[1], instrument: match[2] },
    }
  }
  if ((match = value.match(/^(.+): synthetic pleural ultrasound teaching frame\.$/))) {
    return {
      key: 'd_synthetic_frame',
      values: { label: exactTranslation(t, match[1]) },
    }
  }
  if ((match = value.match(/^(.+)% beams$/))) {
    return { key: 'd_beam_count', values: { percent: match[1] } }
  }
  if ((match = value.match(/^matching "(.+)"$/))) {
    return { key: 'd_matching_query', values: { query: match[1] } }
  }
  if ((match = value.match(/^, (\d+) unattributed omitted$/))) {
    return { key: 'd_unattributed_omitted', values: { count: match[1] } }
  }
  if ((match = value.match(/^(.+) L\/min (adequate|low|ok)$/))) {
    return {
      key: 'd_flow_status',
      values: { flow: match[1], status: exactTranslation(t, match[2]) },
    }
  }

  return null
}

/** Translate handoff copy while preserving surrounding whitespace and runtime values. */
export function translateHandoffText(t: HandoffRawTranslator, value: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  const normalized = normalizeLookupText(value)
  const exact = exactTranslation(t, normalized)

  if (exact !== normalized) {
    return `${leading}${exact}${trailing}`
  }

  const dynamic = matchDynamicText(t, normalized)
  if (!dynamic) {
    return value
  }

  try {
    return `${leading}${t(dynamic.key, dynamic.values)}${trailing}`
  } catch {
    return value
  }
}
