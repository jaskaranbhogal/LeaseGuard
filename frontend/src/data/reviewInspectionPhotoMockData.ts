export interface ReviewInspectionPhotoData {
  title: string;
  area: string;
  step: number;
  totalSteps: number;
  photoLabel: string;
  quality: {
    badge: string;
    title: string;
    description: string;
  };
  footer: string;
}

export const reviewInspectionPhotoMockData: ReviewInspectionPhotoData = {
  title: 'Review photo',
  area: 'Bathroom ceiling',
  step: 1,
  totalSteps: 4,
  photoLabel: 'CAPTURED PHOTO',
  quality: {
    badge: 'CLEAR',
    title: 'Angle matches baseline guide',
    description: 'Ready to use for comparison.',
  },
  footer: 'You can review every photo before submitting the inspection.',
};
