import type { MaintenanceRequestId } from '../types/maintenance';

export type HistoryEntryType = 'move-in' | 'inspection' | 'maintenance';

type HistoryEntryDetails = {
  id: string;
  badge: string;
  title: string;
  details: string;
  status?: string;
};

export type UnitHistoryEntry = HistoryEntryDetails &
  (
    | { type: 'maintenance'; requestId: MaintenanceRequestId }
    | { type: 'move-in' | 'inspection' }
  );

export interface UnitHistoryData {
  title: string;
  subtitle: string;
  entries: UnitHistoryEntry[];
  comparison: {
    title: string;
    description: string;
  };
}

export const unitHistoryMockData: UnitHistoryData = {
  title: 'My unit history',
  subtitle: 'A shared condition record since move-in.',

  entries: [
    {
      id: 'move-in-1',
      type: 'move-in',
      badge: 'MOVE-IN',
      title: 'Baseline condition',
      details: 'Jun 1, 2026 • 14 photos',
    },
    {
      id: 'inspection-1',
      type: 'inspection',
      badge: 'INSPECTION',
      title: 'Routine inspection',
      details: 'Sep 22, 2026 • 4 photos',
      status: '1 landlord-confirmed finding',
    },
    {
      id: 'maintenance-1',
      requestId: 'maintenance-1',
      type: 'maintenance',
      badge: 'MAINTENANCE',
      title: 'Kitchen sink leak',
      details: 'Reported Sep 21',
      status: 'Status: In progress',
    },
    {
      id: 'maintenance-2',
      requestId: 'maintenance-2',
      type: 'maintenance',
      badge: 'MAINTENANCE',
      title: 'Bedroom window latch',
      details: 'Reported Sep 28',
      status: 'Status: In review',
    },
  ],

  comparison: {
    title: 'Move-in ↔ move-out',
    description:
      'When the lease ends, both records can be reviewed side by side.',
  },
};
