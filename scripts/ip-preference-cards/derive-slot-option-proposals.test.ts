import {
  buildSlotOptionProposalArtifact,
  type AuthoredSlotOptionRow,
  type ProposalProductRoleRow,
  type ProposalProductRow,
  type ProposalProcedureRow,
  type ProposalRoleRow,
  type ProposalSlotRow,
} from './derive-slot-option-proposals'

interface Fixture {
  products: ProposalProductRow[]
  productRoles: ProposalProductRoleRow[]
  procedures: ProposalProcedureRow[]
  roles: ProposalRoleRow[]
  slots: ProposalSlotRow[]
  authoredOptions: AuthoredSlotOptionRow[]
  exceptions: unknown
  distributionConfirmations: {
    product_id: string
    match_strength: string
    gudid_distribution_status: string
  }[]
}

function fixture(): Fixture {
  return {
    products: [
      {
        product_id: 'PRD-A',
        manufacturer_id: 'MFR-A',
        manufacturer: 'Acme',
        product_name: 'Authored product',
        catalog_number: 'A-1',
        verification_grade: 'verified_source',
        visibility_state: 'prototype_visible',
        primary_source_id: 'SRC-A',
        primary_source_location: 'p. 1',
      },
      {
        product_id: 'PRD-B',
        manufacturer_id: 'MFR-B',
        manufacturer: 'Bravo',
        product_name: 'Unreviewed candidate',
        catalog_number: 'B-1',
        verification_grade: 'candidate',
        visibility_state: 'hidden',
        primary_source_id: 'SRC-B',
        primary_source_location: 'p. 2',
      },
      {
        product_id: 'PRD-C',
        manufacturer_id: 'MFR-C',
        manufacturer: 'Charlie',
        product_name: 'Role B product',
        catalog_number: 'C-1',
        verification_grade: 'unknown',
        visibility_state: 'hidden',
        primary_source_id: null,
        primary_source_location: null,
      },
    ],
    productRoles: [
      { product_id: 'PRD-A', role_code: 'ROLE_A', role_fit: 'Exact' },
      { product_id: 'PRD-B', role_code: 'ROLE_A', role_fit: 'Compatible' },
      { product_id: 'PRD-C', role_code: 'ROLE_B', role_fit: 'Primary' },
    ],
    procedures: [{ procedure_code: 'PROC_A' }],
    roles: [{ role_code: 'ROLE_A' }, { role_code: 'ROLE_B' }],
    slots: [
      {
        slot_id: 'SLOT-A',
        procedure_code: 'PROC_A',
        display_order: 1,
        slot_label: 'Required A',
        requiredness: 'required',
        role_code: 'ROLE_A',
        allow_custom: true,
      },
      {
        slot_id: 'SLOT-B',
        procedure_code: 'PROC_A',
        display_order: 2,
        slot_label: 'Required B',
        requiredness: 'required',
        role_code: 'ROLE_B',
        allow_custom: false,
      },
      {
        slot_id: 'SLOT-C',
        procedure_code: 'PROC_A',
        display_order: 3,
        slot_label: 'Optional A',
        requiredness: 'optional',
        role_code: 'ROLE_A',
        allow_custom: true,
      },
    ],
    authoredOptions: [
      {
        slot_id: 'SLOT-A',
        product_id: 'PRD-A',
        role_code: 'ROLE_A',
        visible_by_default: true,
        selectable: true,
      },
    ],
    exceptions: [],
    distributionConfirmations: [
      {
        product_id: 'PRD-B',
        match_strength: 'manufacturer_and_catalog_number',
        gudid_distribution_status: 'Not in Commercial Distribution',
      },
    ],
  }
}

describe('slot-product-option proposal generation', () => {
  it('keeps authored rows authoritative and emits only missing pairs', () => {
    const input = fixture()
    const authoredBefore = JSON.stringify(input.authoredOptions)
    const artifact = buildSlotOptionProposalArtifact(input)

    expect(JSON.stringify(input.authoredOptions)).toBe(authoredBefore)
    expect(
      artifact.proposals.some(
        (proposal) => proposal.slot_id === 'SLOT-A' && proposal.product_id === 'PRD-A',
      ),
    ).toBe(false)
    expect(artifact.summary.authored_canonical_options).toBe(1)
    expect(artifact.summary.generated_unreviewed_proposals).toBe(4)
  })

  it('marks every proposal unreviewed, nonselectable, and hidden by default', () => {
    const artifact = buildSlotOptionProposalArtifact(fixture())

    for (const proposal of artifact.proposals) {
      expect(proposal).toMatchObject({
        proposal_origin: 'product_role_join',
        proposal_status: 'unreviewed',
        selectable: false,
        visible_by_default: false,
        reason_code: 'missing_authored_slot_product_option',
      })
      expect(proposal.reason).toContain('does not assert compatibility')
    }
  })

  it('carries existing local distribution evidence without using it as approval', () => {
    const proposal = buildSlotOptionProposalArtifact(fixture()).proposals.find(
      (candidate) => candidate.product_id === 'PRD-B',
    )
    expect(proposal?.current_distribution_status).toBe('not_in_distribution')
    expect(proposal?.proposal_status).toBe('unreviewed')
  })

  it('uses exact GUDID distribution status already stored on the local catalog product', () => {
    const input = fixture()
    input.products.find((product) => product.product_id === 'PRD-C')!.spec_json = {
      gudid_primary_di: '00123456789012',
      gudid_distribution_status: 'In Commercial Distribution',
    }

    const proposal = buildSlotOptionProposalArtifact(input).proposals.find(
      (candidate) => candidate.product_id === 'PRD-C',
    )

    expect(proposal?.current_distribution_status).toBe('in_distribution')
    expect(proposal?.proposal_status).toBe('unreviewed')
  })

  it('leaves distribution context unset when strong local evidence conflicts', () => {
    const input = fixture()
    input.products.find((product) => product.product_id === 'PRD-B')!.spec_json = {
      gudid_distribution_status: 'In Commercial Distribution',
    }

    const proposal = buildSlotOptionProposalArtifact(input).proposals.find(
      (candidate) => candidate.product_id === 'PRD-B',
    )

    expect(proposal?.current_distribution_status).toBeNull()
  })

  it('lets a valid exact exception suppress only its matching proposal', () => {
    const input = fixture()
    input.exceptions = [
      {
        product_id: 'PRD-C',
        slot_id: 'SLOT-B',
        rationale_category: 'compatibility',
        rationale: 'This exact accessory requires a different reviewed platform configuration.',
      },
    ]

    const artifact = buildSlotOptionProposalArtifact(input)

    expect(artifact.summary.excluded_proposal_pairs).toBe(1)
    expect(artifact.summary.generated_unreviewed_proposals).toBe(3)
    expect(
      artifact.proposals.some(
        (proposal) => proposal.slot_id === 'SLOT-B' && proposal.product_id === 'PRD-C',
      ),
    ).toBe(false)
    expect(artifact.proposals.some((proposal) => proposal.product_id === 'PRD-B')).toBe(true)
  })

  it('fails a stale exception, including one aimed at an authored row', () => {
    const input = fixture()
    input.exceptions = [
      {
        product_id: 'PRD-A',
        slot_id: 'SLOT-A',
        rationale_category: 'clinical',
        rationale: 'This authored row cannot be hidden by a proposal-only exception.',
      },
    ]

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(/Stale slot-option exception/)
  })

  it('fails malformed and product-only global exceptions through Zod validation', () => {
    const malformed = fixture()
    malformed.exceptions = [
      {
        product_id: 'PRD-B',
        rationale_category: 'clinical',
        rationale: 'This reason is long enough but has no narrowing field.',
      },
    ]
    expect(() => buildSlotOptionProposalArtifact(malformed)).toThrow(
      /must narrow by exact slot_id or role_code/,
    )

    const trivial = fixture()
    trivial.exceptions = [
      {
        product_id: 'PRD-B',
        role_code: 'ROLE_A',
        rationale_category: 'clinical',
        rationale: 'No.',
      },
    ]
    expect(() => buildSlotOptionProposalArtifact(trivial)).toThrow(/substantive review reason/)
  })

  it('fails duplicate and overlapping exception scopes', () => {
    const duplicate = fixture()
    const exception = {
      product_id: 'PRD-B',
      slot_id: 'SLOT-A',
      rationale_category: 'dimensional' as const,
      rationale: 'The exact product dimension does not fit this exact authored slot.',
    }
    duplicate.exceptions = [exception, { ...exception, rationale: `${exception.rationale} Again.` }]
    expect(() => buildSlotOptionProposalArtifact(duplicate)).toThrow(
      /Duplicate slot-option exception/,
    )

    const overlapping = fixture()
    overlapping.exceptions = [
      {
        product_id: 'PRD-B',
        role_code: 'ROLE_A',
        rationale_category: 'compatibility',
        rationale: 'The product requires a platform that is not specified by these slots.',
      },
      {
        product_id: 'PRD-B',
        slot_id: 'SLOT-A',
        rationale_category: 'compatibility',
        rationale: 'This exact slot does not specify the product platform requirements.',
      },
    ]
    expect(() => buildSlotOptionProposalArtifact(overlapping)).toThrow(/overlapping exceptions/)
  })

  it('fails exception identifiers that are unknown or contradict their slot', () => {
    const unknown = fixture()
    unknown.exceptions = [
      {
        product_id: 'PRD-NOT-KNOWN',
        role_code: 'ROLE_A',
        rationale_category: 'clinical',
        rationale: 'This unknown identifier cannot be used as a valid suppression target.',
      },
    ]
    expect(() => buildSlotOptionProposalArtifact(unknown)).toThrow(/unknown product/)

    const contradiction = fixture()
    contradiction.exceptions = [
      {
        product_id: 'PRD-B',
        slot_id: 'SLOT-A',
        role_code: 'ROLE_B',
        rationale_category: 'compatibility',
        rationale: 'This deliberately contradictory scope must fail strict validation.',
      },
    ]
    expect(() => buildSlotOptionProposalArtifact(contradiction)).toThrow(/contradicts slot SLOT-A/)
  })

  it.each([
    ['slot_id', 'SLOT-NOT-KNOWN', /unknown slot SLOT-NOT-KNOWN/],
    ['procedure_code', 'PROC_NOT_KNOWN', /unknown procedure PROC_NOT_KNOWN/],
    ['role_code', 'ROLE_NOT_KNOWN', /unknown role ROLE_NOT_KNOWN/],
  ] as const)('fails an exception with an unknown %s', (field, value, expectedError) => {
    const input = fixture()
    input.exceptions = [
      {
        product_id: 'PRD-B',
        role_code: 'ROLE_A',
        rationale_category: 'compatibility',
        rationale: 'This exception uses an identifier that is not in canonical generated data.',
        [field]: value,
      },
    ]

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(expectedError)
  })

  it('fails a known procedure and role exception scope when no slot has that combination', () => {
    const input = fixture()
    input.procedures.push({ procedure_code: 'PROC_B' })
    input.exceptions = [
      {
        product_id: 'PRD-B',
        procedure_code: 'PROC_B',
        role_code: 'ROLE_A',
        rationale_category: 'compatibility',
        rationale: 'This known procedure does not contain a slot carrying the requested role.',
      },
    ]

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(
      /contradicts procedure PROC_B: it has no slot with role ROLE_A/,
    )
  })

  it('uses a strict exception schema that rejects unrecognized fields', () => {
    const input = fixture()
    input.exceptions = [
      {
        product_id: 'PRD-B',
        role_code: 'ROLE_A',
        rationale_category: 'compatibility',
        rationale: 'This otherwise valid exception contains an unsupported review field.',
        review_note: 'This field is not part of the exception contract.',
      },
    ]

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(/Unrecognized key/)
  })

  it('fails an authored slot-role mismatch', () => {
    const input = fixture()
    input.authoredOptions[0].role_code = 'ROLE_B'

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(/slot role is ROLE_A/)
  })

  it('fails an authored option without the matching Product_Roles relationship', () => {
    const input = fixture()
    input.productRoles = input.productRoles.filter(
      (relationship) =>
        !(relationship.product_id === 'PRD-A' && relationship.role_code === 'ROLE_A'),
    )

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(/has no Product_Roles pair/)
  })

  it('fails a canonical row that violates authored selectability rules', () => {
    const input = fixture()
    input.authoredOptions[0].selectable = false

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(
      /expected true from authored visibility rules/,
    )
  })

  it.each([
    ['slot_id', 'SLOT-NOT-KNOWN', /unknown slot SLOT-NOT-KNOWN/],
    ['product_id', 'PRD-NOT-KNOWN', /unknown product PRD-NOT-KNOWN/],
  ] as const)(
    'fails an authored option with an unknown %s foreign key',
    (field, value, expectedError) => {
      const input = fixture()
      input.authoredOptions[0][field] = value

      expect(() => buildSlotOptionProposalArtifact(input)).toThrow(expectedError)
    },
  )

  it('fails duplicate canonical options and duplicate proposal-producing role pairs', () => {
    const duplicateCanonical = fixture()
    duplicateCanonical.authoredOptions.push({ ...duplicateCanonical.authoredOptions[0] })
    expect(() => buildSlotOptionProposalArtifact(duplicateCanonical)).toThrow(
      /Slot_Product_Options has duplicate pair SLOT-A × PRD-A/,
    )

    const duplicateProposalInput = fixture()
    duplicateProposalInput.productRoles.push({ ...duplicateProposalInput.productRoles[1] })
    expect(() => buildSlotOptionProposalArtifact(duplicateProposalInput)).toThrow(
      /Product_Roles has duplicate pair PRD-B × ROLE_A/,
    )
  })

  it('fails unreviewed proposal metadata embedded in a canonical option', () => {
    const input = fixture()
    input.authoredOptions[0].proposal_status = 'unreviewed'

    expect(() => buildSlotOptionProposalArtifact(input)).toThrow(
      /Canonical option SLOT-A × PRD-A contains unreviewed proposal metadata/,
    )
  })

  it('is deterministic when every source array arrives in reverse order', () => {
    const forward = fixture()
    const reversed = fixture()
    reversed.products.reverse()
    reversed.productRoles.reverse()
    reversed.procedures.reverse()
    reversed.roles.reverse()
    reversed.slots.reverse()
    reversed.authoredOptions.reverse()
    reversed.distributionConfirmations.reverse()

    expect(buildSlotOptionProposalArtifact(reversed)).toEqual(
      buildSlotOptionProposalArtifact(forward),
    )
  })
})
