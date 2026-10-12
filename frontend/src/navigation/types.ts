import type { ResetDelivery } from '../services/authService';

export type AuthStackParamList = {
  Loading: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetEmailSent: { email: string; delivery: ResetDelivery };
};
