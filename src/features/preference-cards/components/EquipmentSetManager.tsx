'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Layers, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'

import { CatalogOptionPicker } from './CatalogOptionPicker'
import { useEquipmentSets } from '../hooks/useEquipmentSets'
import { equipmentSetCoveredRoles, type EquipmentSet } from '../domain/equipment-set'
import type { CatalogPick } from '../domain/catalog-pick'

export interface EquipmentSetRole {
  code: string
  name: string
  category: string
}

export interface EquipmentSetManagerLabels {
  heading: string
  description: string
  newSet: string
  setName: string
  setNamePlaceholder: string
  setDescription: string
  setDescriptionPlaceholder: string
  members: string
  noMembers: string
  addFor: string
  chooseRole: string
  coveredRoles: string
  coveredRolesHelp: string
  alsoCovers: string
  alsoCoversHelp: string
  save: string
  cancel: string
  edit: string
  duplicate: string
  remove: string
  empty: string
  emptyHelp: string
  addMember: string
}

interface EquipmentSetManagerProps {
  roles: EquipmentSetRole[]
  labels: EquipmentSetManagerLabels
}

function blankSet(): EquipmentSet {
  const now = new Date().toISOString()
  return {
    id: `set-${now}-${Math.round(performance.now())}`,
    name: '',
    description: null,
    members: [],
    additionalCoveredRoles: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Create and edit reusable equipment sets.
 *
 * A set lists the products a tray actually contains, plus any extra requirement it
 * satisfies without a distinct product — the case where one instrument covers two
 * requirements, such as a rigid scope with an integrated head.
 */
export function EquipmentSetManager({ roles, labels }: EquipmentSetManagerProps) {
  // The two counts are translated here rather than passed in: they are plurals, and a
  // server-rendered string would have to be substituted by hand, which silently prints the
  // raw ICU source the moment the message becomes a real plural.
  const t = useTranslations('preferenceCards.sets')
  const { sets, saveSet, deleteSet, duplicateSet } = useEquipmentSets()
  const [draft, setDraft] = useState<EquipmentSet | null>(null)
  const [memberRole, setMemberRole] = useState(roles[0]?.code ?? '')

  const rolesByCode = useMemo(() => new Map(roles.map((role) => [role.code, role])), [roles])
  const roleName = (code: string) => rolesByCode.get(code)?.name ?? code

  const draftCoveredRoles = draft ? equipmentSetCoveredRoles(draft) : []
  const memberProductIds = useMemo(
    () => new Set(draft?.members.map((member) => member.productId) ?? []),
    [draft],
  )

  const addMember = (pick: CatalogPick) => {
    setDraft((current) =>
      current && !current.members.some((member) => member.productId === pick.productId)
        ? { ...current, members: [...current.members, pick] }
        : current,
    )
  }

  const removeMember = (productId: string) => {
    setDraft((current) =>
      current
        ? { ...current, members: current.members.filter((m) => m.productId !== productId) }
        : current,
    )
  }

  const toggleAdditionalRole = (code: string) => {
    setDraft((current) => {
      if (!current) return current
      const has = current.additionalCoveredRoles.includes(code)
      return {
        ...current,
        additionalCoveredRoles: has
          ? current.additionalCoveredRoles.filter((role) => role !== code)
          : [...current.additionalCoveredRoles, code],
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{labels.heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
        </div>
        {!draft ? (
          <Button type="button" onClick={() => setDraft(blankSet())}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {labels.newSet}
          </Button>
        ) : null}
      </div>

      {draft ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">{labels.newSet}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium" htmlFor="set-name">
                <span>{labels.setName}</span>
                <input
                  id="set-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  placeholder={labels.setNamePlaceholder}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium" htmlFor="set-description">
                <span>{labels.setDescription}</span>
                <input
                  id="set-description"
                  value={draft.description ?? ''}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, description: event.target.value || null } : current,
                    )
                  }
                  placeholder={labels.setDescriptionPlaceholder}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{labels.members}</h3>
              {draft.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">{labels.noMembers}</p>
              ) : (
                <ul className="space-y-2">
                  {draft.members.map((member) => (
                    <li
                      key={member.productId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary">
                          {member.manufacturerDisplay}
                        </p>
                        <p className="text-sm text-foreground">{member.productName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {member.catalogNumber ?? '—'} · {roleName(member.roleCode)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.productId)}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        <span className="sr-only">{labels.remove}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="rounded-lg border border-dashed border-border p-3">
                <label className="block space-y-1.5 text-sm font-medium" htmlFor="set-member-role">
                  <span>{labels.addFor}</span>
                  <select
                    id="set-member-role"
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {roles.map((role) => (
                      <option key={role.code} value={role.code}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                {memberRole ? (
                  <CatalogOptionPicker
                    roleCode={memberRole}
                    roleLabel={roleName(memberRole)}
                    existingProductIds={memberProductIds}
                    onAdd={addMember}
                    addLabel={labels.addMember}
                  />
                ) : null}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{labels.alsoCovers}</h3>
              <p className="text-xs text-muted-foreground">{labels.alsoCoversHelp}</p>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => {
                  const fromMember = draft.members.some((member) => member.roleCode === role.code)
                  const checked = draft.additionalCoveredRoles.includes(role.code)
                  return (
                    <button
                      key={role.code}
                      type="button"
                      disabled={fromMember}
                      onClick={() => toggleAdditionalRole(role.code)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition',
                        fromMember
                          ? 'cursor-not-allowed border-border bg-muted text-muted-foreground'
                          : checked
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary hover:text-primary',
                      )}
                    >
                      {role.name}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold">{labels.coveredRoles}</h3>
              <p className="text-xs text-muted-foreground">{labels.coveredRolesHelp}</p>
              <div className="flex flex-wrap gap-1.5">
                {draftCoveredRoles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  draftCoveredRoles.map((code) => (
                    <Badge
                      key={code}
                      variant="secondary"
                      size="sm"
                      className="normal-case tracking-normal"
                    >
                      {roleName(code)}
                    </Badge>
                  ))
                )}
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!draft.name.trim() || draftCoveredRoles.length === 0}
                onClick={() => {
                  saveSet({ ...draft, name: draft.name.trim() })
                  setDraft(null)
                }}
              >
                {labels.save}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                {labels.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {sets.length === 0 && !draft ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="p-8 text-center">
            <h3 className="font-semibold">{labels.empty}</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              {labels.emptyHelp}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sets.map((set) => {
            const covered = equipmentSetCoveredRoles(set)
            return (
              <Card key={set.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Layers aria-hidden="true" className="h-4 w-4 text-primary" />
                    {set.name}
                  </CardTitle>
                  {set.description ? (
                    <p className="text-sm text-muted-foreground">{set.description}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {t('memberCount', { count: set.members.length })} ·{' '}
                    {t('roleCount', { count: covered.length })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {covered.map((code) => (
                      <Badge
                        key={code}
                        variant="outline"
                        size="sm"
                        className="normal-case tracking-normal"
                      >
                        {roleName(code)}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setDraft(set)}>
                      {labels.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateSet(set.id)}
                    >
                      <Copy aria-hidden="true" className="h-4 w-4" />
                      {labels.duplicate}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSet(set.id)}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {labels.remove}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
