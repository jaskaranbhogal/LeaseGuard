import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TenantTabs from './TenantTabs';

import GuidedInspectionScreen from '../screens/tenant/GuidedInspectionScreen';
import ReportMaintenanceScreen from '../screens/tenant/ReportMaintenanceScreen';
import InspectionAvailabilityScreen from '../screens/tenant/InspectionAvailabilityScreen';
import MaintenanceDetailScreen from '../screens/tenant/MaintenanceDetailScreen';
import ReviewInspectionPhotoScreen from '../screens/tenant/ReviewInspectionPhotoScreen';
import InspectionSubmittedScreen from '../screens/tenant/InspectionSubmittedScreen';

export type TenantStackParamList = {
  TenantTabs: undefined;
  GuidedInspection: undefined;
  ReportMaintenance: undefined;
  InspectionAvailability: undefined;
  MaintenanceDetail: undefined;
  ReviewInspectionPhoto: undefined;
  InspectionSubmitted: undefined;
};

const Stack = createNativeStackNavigator<TenantStackParamList>();

export default function TenantNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="TenantTabs"
        component={TenantTabs}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="GuidedInspection"
        component={GuidedInspectionScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="ReportMaintenance"
        component={ReportMaintenanceScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="InspectionAvailability"
        component={InspectionAvailabilityScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="MaintenanceDetail"
        component={MaintenanceDetailScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="ReviewInspectionPhoto"
        component={ReviewInspectionPhotoScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="InspectionSubmitted"
        component={InspectionSubmittedScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
