import type { NavigatorScreenParams } from '@react-navigation/native';
import type { ResetDelivery } from '../services/authService';

export type AuthStackParamList = {
  Loading: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetEmailSent: { email: string; delivery: ResetDelivery };
};

export type LandlordStackParamList = {
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
