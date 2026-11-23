// Presentation types retained from Jon; no data store or sample records.
export type TenantLink = {
  email: string;
  name?: string;
  status: 'pending' | 'joined' | 'declined';
  invitedOn: string;
  delivery?: string;
  joinedOn?: string;
  declinedOn?: string;
};

export type PhotoMap = Record<string, string>;

export type Slot = { id: string; date: string; time: string };

export type InspectionStatus =
  | 'scheduled'
  | 'awaiting-times'
  | 'times-sent'
  | 'times-declined'
  | 'confirmed'
  | 'submitted';

export type AIFinding = {
  description: string;
  classification: 'normal_wear' | 'damage';
  pre_existing_worsened: boolean;
};

// Gemini's answer for one area (inspections/schemas.py), or why it is missing.
export type AreaResult =
  | {
      photo_quality: 'good' | 'too_dark' | 'blurry' | 'wrong_area';
      same_area: boolean;
      change_detected: boolean;
      classification: 'none' | 'normal_wear' | 'damage';
      severity: 'low' | 'medium' | 'high' | null;
      confidence: 'low' | 'medium' | 'high';
      obstructed_areas: string | null;
      findings: AIFinding[];
      summary: string;
    }
  | { error: string };

export type InspectionAI = {
  status: 'pending' | 'done' | 'error';
  results: Record<string, AreaResult>;
};

export type Inspection = {
  id: string;
  kind: 'remote' | 'inperson';
  areas: string[];
  status: InspectionStatus;
  createdOn: string;
  dueDate?: string;
  slots?: Slot[];
  tenantSlots?: string[];
  confirmedSlot?: string;
  photos: PhotoMap;
  notes?: Record<string, string>;
  submittedOn?: string;
  ai?: InspectionAI;
};

export type Unit = {
  revision: number;
  assignmentId?: string;
  id: string;
  name: string;
  bedrooms: string;
  bathrooms: string;
  tenant?: TenantLink;
  areas: string[];
  baselinePhotos?: PhotoMap;
  baselineRecordedOn?: string;
  baselineNotes?: Record<string, string>;
  inspections?: Inspection[];
};

export type Property = {
  id: string;
  street: string;
  city: string;
  units: Unit[];
};

export type Activity = {
  id: string;
  title: string;
  detail: string;
};

export type LandlordSnapshot = {
  consented: boolean;
  properties: Property[];
  activity: Activity[];
};

export type Invite = {
  previewLocked?: boolean;
  email: string;
  landlordId: string;
  landlordName: string;
  propertyId: string;
  unitId: string;
  street: string;
  city: string;
  unit: string;
  bedrooms: string;
  bathrooms: string;
  areaCount: number;
};

export type TenantSnapshot = {
  consented: boolean;
  welcomed: boolean;
  baselineReviewed?: boolean;
  movePhotos?: PhotoMap;
};

export type UnitDetails = {
  areas: string[];
  baselinePhotos: PhotoMap;
  baselineRecordedOn?: string;
  baselineNotes?: Record<string, string>;
  landlordName: string;
  inspection?: Inspection;
};

export function currentInspection(unit: {
  inspections?: Inspection[];
}): Inspection | undefined {
  const list = unit.inspections ?? [];
  return list[list.length - 1];
}
