import UnitHistoryScreen from '../screens/tenant/UnitHistoryScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PrivacySecurityScreen from '../screens/shared/PrivacySecurityScreen';
import TenantTabs from './TenantTabs';

import GuidedInspectionScreen from '../screens/tenant/GuidedInspectionScreen';
import ReportMaintenanceScreen from '../screens/tenant/ReportMaintenanceScreen';
import InspectionAvailabilityScreen from '../screens/tenant/InspectionAvailabilityScreen';
import MaintenanceDetailScreen from '../screens/tenant/MaintenanceDetailScreen';
import ReviewInspectionPhotoScreen from '../screens/tenant/ReviewInspectionPhotoScreen';
import InspectionSubmittedScreen from '../screens/tenant/InspectionSubmittedScreen';

import type { TenantStackParamList } from './types';
import { InspectionProvider } from '../context/InspectionContext';

const Stack = createNativeStackNavigator<TenantStackParamList>();

export default function TenantNavigator() {
  return (
    <InspectionProvider>
      <Stack.Navigator>
        <Stack.Screen
          name="TenantTabs"
          component={TenantTabs}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="History"
          component={UnitHistoryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivacySecurity"
          component={PrivacySecurityScreen}
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
    </InspectionProvider>
  );
}
