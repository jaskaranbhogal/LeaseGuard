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
  id: string;
  location: string;
  urgency: string;
  description: string;
  reportedDate: string;
  photoCount: number;
  videoCount: number;
  status: MaintenanceStatus;
  updates: MaintenanceUpdate[];
}

export const maintenanceDetailMockData: MaintenanceRequest = {
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
      message: 'You submitted the request',
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
};
