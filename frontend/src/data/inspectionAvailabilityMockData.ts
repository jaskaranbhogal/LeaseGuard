export interface InspectionTimeSlot {
  id: string;
  date: string;
  time: string;
}

export interface InspectionAvailabilityData {
  title: string;
  description: string;
  instruction: string;
  timeSlots: InspectionTimeSlot[];
}

export const inspectionAvailabilityMockData: InspectionAvailabilityData = {
  title: 'Your availability',
  description: 'Landlord requested an in-person inspection.',
  instruction: 'Select the time slots that work for you.',
  timeSlots: [
    { id: '1', date: 'Thu, Oct 8', time: '6–8 PM' },
    { id: '2', date: 'Fri, Oct 9', time: '5–7 PM' },
    { id: '3', date: 'Sat, Oct 10', time: '10 AM–1 PM' },
  ],
};
