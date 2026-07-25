import fs from 'node:fs'
import path from 'node:path'

const migration = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260725210000_add_ip_preference_cards.sql'),
  'utf8',
)

describe('preference-card migration contract', () => {
  it('adds the builder entitlement and organization-aware RLS helpers', () => {
    expect(migration).toContain("'preference_cards_builder'")
    expect(migration).toContain('create function public.ip_is_org_member')
    expect(migration).toContain("'ip_case_cards'")
    expect(migration).toContain('enable row level security')
    expect(migration).toContain('ip_case_cards_select_member')
  })

  it('makes generated snapshot tables immutable', () => {
    for (const trigger of [
      'ip_case_cards_immutable',
      'ip_case_card_modifiers_immutable',
      'ip_case_card_items_immutable',
      'ip_case_card_warnings_immutable',
    ]) {
      expect(migration).toContain(trigger)
    }
    expect(migration).toContain('Generated IP preference-card snapshots are immutable')
  })

  it('does not introduce common PHI fields', () => {
    expect(migration).not.toMatch(
      /\b(patient_name|mrn|date_of_birth|dob|encounter_number|diagnosis)\b/i,
    )
  })
})
