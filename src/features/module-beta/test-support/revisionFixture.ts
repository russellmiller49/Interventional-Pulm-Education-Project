import type { BetaModuleRevision } from '../revisions'

export const revisionFixture = {
  moduleId: 'baxter-crrt',
  revisionId: 'test-crrt-first',
  sequence: 1,
  displayVersion: 'Test revision 1',
  releasedOn: '2026-01-15',
  category: 'educational',
  changelog: ['Example change for automated tests.'],
  affectedSections: [
    {
      id: 'crrt-prescription-dosing',
      title: 'Prescription and dosing',
      path: '/baxter-crrt/learn?lesson=crrt-prescription-dosing',
    },
    { id: 'example-section', title: 'Example without a navigation target' },
  ],
  rereviewRecommended: true,
} as const satisfies BetaModuleRevision
