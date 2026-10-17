export type UserRole = 'tenant' | 'landlord';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole | null;
}
