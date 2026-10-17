import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ResetDelivery } from '../services/authService';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetEmailSent: { email: string; delivery: ResetDelivery };
};

export type LandlordStackParamList = {
  Notifications: undefined;
  Dashboard: undefined;
  AddProperty: undefined;
  ScheduleInspection: undefined;
  AIInspectionReview: undefined;
};

export type LandlordTabParamList = {
  HomeStack: NavigatorScreenParams<LandlordStackParamList> | undefined;
  History: undefined;
  Settings: undefined;
};

export type TenantTabParamList = {
  Home: undefined;
  Inspections: undefined;
  History: undefined;
  Settings: undefined;
};

export type TenantStackParamList = {
  Notifications: undefined;
  TenantTabs:
    | import('@react-navigation/native').NavigatorScreenParams<TenantTabParamList>
    | undefined;
  GuidedInspection: undefined;
  ReportMaintenance: undefined;
  InspectionAvailability: undefined;
  MaintenanceDetail: {
    requestId: import('../types/maintenance').MaintenanceRequestId;
  };
  ReviewInspectionPhoto: { stepIndex: number };
  InspectionSubmitted: undefined;
};
