import { authPost, request } from './api';
import type {
  Activity,
  Invite,
  PhotoMap,
  Property,
  UnitDetails,
} from '../types/housing';
export const POLICY_VERSION = '2026-11-21';
export type LandlordState = {
  consented: boolean;
  properties: Property[];
  activity: Activity[];
  created_unit_id?: string;
};
export type TenantState = {
  consented: boolean;
  welcomed: boolean;
  baselineReviewed: boolean;
  movePhotos: PhotoMap;
  unit: Invite | null;
  details: UnitDetails | null;
  pendingInvite: (Invite & { id: string }) | null;
};
export const consent = () =>
  authPost('/housing/consent/', {
    policy_version: POLICY_VERSION,
    accepted: true,
  });
export const landlordApi = {
  state: () => request<LandlordState>('/landlord/state/'),
  addProperty: (data: object) =>
    authPost<LandlordState>('/landlord/properties/', data),
  addUnit: (id: string, data: object) =>
    authPost<LandlordState>(`/landlord/properties/${id}/units/`, data),
  updateUnit: (id: string, data: object) =>
    authPost<LandlordState>(`/landlord/units/${id}/`, data),
  invite: (id: string, email: string) =>
    authPost<LandlordState>(`/landlord/units/${id}/tenant/`, { email }),
  removeTenant: async (id: string, data: object) => {
    const { csrfToken } = await request<{ csrfToken: string }>('/auth/csrf/');
    return request<LandlordState>(`/landlord/units/${id}/tenant/`, {
      method: 'DELETE',
      body: JSON.stringify(data),
      headers: { 'X-CSRFToken': csrfToken },
    });
  },
};
export const tenantApi = {
  state: () => request<TenantState>('/tenant/state/'),
  respond: (decision: 'accept' | 'decline', token: string) =>
    authPost<TenantState>(`/tenant/invite/${decision}/`, { token }),
};
export type Appointment = {
  id: string;
  unit_id: string;
  tenant_id: string;
  timezone: string;
  status: string;
  revision: number;
  slots: { id: string; at: string }[];
  tenant_slots: string[];
  confirmed_slot: string;
  history: { action: string; actor: string; at: string }[];
};
export const listAppointments = () =>
  request<{ appointments: Appointment[] }>('/housing/appointments/');
export const offerAppointment = (data: object) =>
  authPost('/housing/appointments/', data);
export const appointmentAction = (a: Appointment, data: object) =>
  authPost(`/housing/appointments/${a.id}/`, { revision: a.revision, ...data });
