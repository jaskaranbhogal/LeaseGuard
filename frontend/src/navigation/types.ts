import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ResetDelivery } from '../services/authService';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  InviteEmail: undefined;
  RegisterInvite: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetEmailSent: { email: string; delivery: ResetDelivery };
};

export type LandlordStackParamList = {
  Notifications: undefined;
  Dashboard: undefined;
  AddProperty: { propertyId?: string } | undefined;
  ScheduleInspection: { propertyId?: string; unitId?: string } | undefined;
  MoveInBaseline: { unitId?: string } | undefined;
  MoveInTour: { propertyId: string; unitId: string };
  EditUnit: { propertyId: string; unitId: string };
  Appointments: undefined;
  AIInspectionReview: { inspectionId: string } | undefined;
  MaintenanceRequests: undefined;
  SavedMaintenanceDetail: { requestId: string };
};

export type LandlordSettingsStackParamList = {
  SettingsHome: undefined;
  PrivacySecurity: undefined;
  PrivacyPolicy: undefined;
  Profile: undefined;
};

export type LandlordTabParamList = {
  HomeStack: NavigatorScreenParams<LandlordStackParamList> | undefined;
  History: undefined;
  Settings: NavigatorScreenParams<LandlordSettingsStackParamList> | undefined;
};
export type TenantTabParamList = {
  Home: undefined;
  Inspections: undefined;
  Settings: undefined;
};

export type TenantStackParamList = {
  History: undefined;
  Notifications: undefined;
  PrivacySecurity: undefined;
  PrivacyPolicy: undefined;
  Profile: undefined;
  TenantTabs:
    | import('@react-navigation/native').NavigatorScreenParams<TenantTabParamList>
    | undefined;
  GuidedInspection: { inspectionId: string } | undefined;
  TenantBaseline: { unitId: string };
  ReportMaintenance: { draftId?: string } | undefined;
  InspectionAvailability: undefined;
  Appointments: undefined;
  MaintenanceDetail: {
    requestId: string;
  };
  ReviewInspectionPhoto: { stepIndex: number };
  InspectionSubmitted: { inspectionId: string } | undefined;
};
