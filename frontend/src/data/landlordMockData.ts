type PropertyStatus = 'review' | 'clear';

interface PropertySummary {
  id: string;
  name: string;
  location: string;
  unitCount: number;
  status: PropertyStatus;
  statusLabel: string;
  headline: string;
  detail: string;
  tag?: string;
}

export const reviewCount = 2;
export const highSeverityCount = 1;

export const properties: PropertySummary[] = [
  {
    id: 'cedar-ave',
    name: '18 Cedar Ave',
    location: 'Farmingdale, NY',
    unitCount: 2,
    status: 'review',
    statusLabel: '2 to review',
    headline: 'Unit 1A • Alyssa Patel',
    detail: 'Inspection submitted',
    tag: 'HIGH',
  },
  {
    id: 'maple-st',
    name: '44 Maple St',
    location: 'Hicksville, NY',
    unitCount: 2,
    status: 'clear',
    statusLabel: 'All clear',
    headline: 'Next inspection: Oct 15',
    detail: 'No open maintenance requests',
  },
];
