export interface InspectionStep {
  id: string;
  area: string;
  instruction: string;
  description: string;
  cameraHint: string;
}

export const guidedInspectionMockData: {
  title: string;
  steps: InspectionStep[];
} = {
  title: 'Guided inspection',
  steps: [
    {
      id: 'bathroom-ceiling',
      area: 'Bathroom ceiling',
      instruction: 'Stand in the bathroom doorway',
      description:
        'Keep the full ceiling corner visible. Match the angle shown in the baseline so LeaseGuard can compare changes consistently.',
      cameraHint: 'Align the ceiling corner inside the guide',
    },
  ],
};
