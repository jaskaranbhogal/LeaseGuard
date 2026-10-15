import type { MaintenanceRequestId } from '../types/maintenance';
import { guidedInspectionMockData } from './guidedInspectionMockData';

export type TenantDashboardData = {
  tenant: {
    firstName: string;
    propertyAddress: string;
    unitNumber: string;
  };
  inspection: {
    title: string;
    dueDate: string;
    requiredAreas: number;
    estimatedMinutes: number;
  } | null;
  recentMaintenance: {
    requestId: MaintenanceRequestId;
    title: string;
    status: string;
    update: string;
  } | null;
  notifications: {
    unreadCount: number;
  };
};

// Temporary sample data based on the LeaseGuard Figma prototype.
// Later, this will be replaced with data from the Django API.
export const tenantMockData: TenantDashboardData = {
  tenant: {
    firstName: 'Alyssa',
    propertyAddress: '18 Cedar Ave',
    unitNumber: '1A',
  },
  inspection: {
    title: 'Routine condition inspection',
    dueDate: 'Oct 8',
    requiredAreas: guidedInspectionMockData.steps.length,
    estimatedMinutes: 5,
  },
  recentMaintenance: {
    requestId: 'maintenance-1',
    title: 'Kitchen sink leak',
    status: 'In progress',
    update: 'Landlord scheduled a plumber for Sep 25',
  },
  notifications: {
    unreadCount: 3,
  },
};
