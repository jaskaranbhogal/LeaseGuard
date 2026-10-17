import { createContext, useContext, useState, type ReactNode } from 'react';
import { guidedInspectionMockData } from '../data/guidedInspectionMockData';

type InspectionState = {
  acceptedCount: number;
  currentStepIndex: number;
  totalSteps: number;
  complete: boolean;
  acceptStep: (index: number) => void;
  restart: () => void;
};
const InspectionContext = createContext<InspectionState | null>(null);

// Demo progress lives above the stack so back navigation and tab changes retain it.
export function InspectionProvider({ children }: { children: ReactNode }) {
  const [acceptedCount, setAcceptedCount] = useState(0);
  const totalSteps = guidedInspectionMockData.steps.length;
  return (
    <InspectionContext.Provider
      value={{
        acceptedCount,
        currentStepIndex: Math.min(acceptedCount, totalSteps - 1),
        totalSteps,
        complete: acceptedCount === totalSteps,
        acceptStep: index =>
          setAcceptedCount(count =>
            index === count && count < totalSteps ? count + 1 : count,
          ),
        restart: () => setAcceptedCount(0),
      }}
    >
      {children}
    </InspectionContext.Provider>
  );
}
export function useInspection() {
  const context = useContext(InspectionContext);
  if (!context) {
    throw new Error('useInspection must be used inside InspectionProvider');
  }
  return context;
}
