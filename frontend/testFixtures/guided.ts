import type {
  GuidedInspection,
  AssignmentOptions,
} from '../src/services/guidedInspectionService';
export const guidedFixture: GuidedInspection = {
  id: 'c'.repeat(32),
  unit_id: 'b'.repeat(24),
  unit: '101',
  property: 'Verified property',
  inspection_type: 'move-in',
  due_at: '2027-12-01T12:00:00Z',
  status: 'assigned',
  overdue: false,
  upcoming: true,
  revision: 0,
  progress: 0,
  required: 5,
  steps: Array.from({ length: 5 }, (_, i) => ({
    id: `step-${i}`,
    room: `Room ${i + 1}`,
    instructions: 'Include walls and floor.',
    count: 1,
  })),
  photos: [],
  uploads: [],
  baseline_available: false,
  baseline_photos: [],
  history: [],
  comparisons: [],
};
export const assignmentOptions: AssignmentOptions = {
  units: [
    {
      id: guidedFixture.unit_id,
      label: '101',
      property: 'Verified property',
      tenants: [{ id: '1'.repeat(24), label: 'Resident' }],
    },
  ],
  templates: [
    {
      id: 'template',
      name: 'Apartment',
      version: 1,
      steps: guidedFixture.steps,
    },
  ],
  default_steps: guidedFixture.steps,
};
