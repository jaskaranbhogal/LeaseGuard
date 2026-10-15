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
    {
      id: 'living-room-wall',
      area: 'Living room wall',
      instruction: 'Stand opposite the living room wall',
      description:
        'Keep the wall edges in the guide. This demonstration uses a placeholder only.',
      cameraHint: 'Align the wall inside the guide',
    },
    {
      id: 'kitchen-fixtures',
      area: 'Kitchen fixtures',
      instruction: 'Stand in front of the kitchen sink',
      description:
        'Include the faucet, basin, and surrounding countertop in the guide.',
      cameraHint: 'Center the sink inside the guide',
    },
    {
      id: 'bedroom-floor',
      area: 'Bedroom floor',
      instruction: 'Stand in the bedroom doorway',
      description:
        'Point the guide toward the floor and include both room corners.',
      cameraHint: 'Keep the floor edges inside the guide',
    },
  ],
};
