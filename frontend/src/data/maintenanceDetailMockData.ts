import type { MaintenanceRequestId } from '../types/maintenance';

export type MaintenanceStatus =
  | 'submitted'
  | 'in-review'
  | 'in-progress'
  | 'resolved';

export interface MaintenanceUpdate {
  id: string;
  date: string;
  message: string;
  highlighted?: boolean;
}

export interface MaintenanceRequest {
  id: MaintenanceRequestId;
  location: string;
  urgency: string;
  description: string;
  reportedDate: string;
  photoCount: number;
  videoCount: number;
  status: MaintenanceStatus;
  updates: MaintenanceUpdate[];
}

export const maintenanceRequests: MaintenanceRequest[] = [
  {
    id: 'maintenance-1',
    location: 'Kitchen sink • Unit 1A',
    urgency: 'MEDIUM URGENCY',
    description: 'Water leaking under sink cabinet',
    reportedDate: 'Sep 21, 2026',
    photoCount: 1,
    videoCount: 1,
    status: 'in-progress',
    updates: [
      {
        id: '1',
        date: 'Sep 21',
        message: 'Sample request opened',
      },
      {
        id: '2',
        date: 'Sep 22',
        message: 'Landlord reviewed the issue',
      },
      {
        id: '3',
        date: 'Sep 25',
        message: 'Plumber scheduled',
        highlighted: true,
      },
    ],
  },
  {
    id: 'maintenance-2',
    location: 'Bedroom window • Unit 1A',
    urgency: 'LOW URGENCY',
    description: 'Window latch sticks when closing',
    reportedDate: 'Sep 28, 2026',
    photoCount: 1,
    videoCount: 0,
    status: 'in-review',
    updates: [
      { id: '1', date: 'Sep 28', message: 'Sample request opened' },
      {
        id: '2',
        date: 'Sep 29',
        message: 'Sample request under review',
        highlighted: true,
      },
    ],
  },
];

export function findMaintenanceRequest(
  id: unknown,
): MaintenanceRequest | undefined {
  return maintenanceRequests.find(request => request.id === id);
}
