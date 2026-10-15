
import {createNativeStackNavigator} from '@react-navigation/native-stack';

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
    <Stack.Navigator initialRouteName="TenantTabs">
      <Stack.Screen
        name="TenantTabs"
        component={TenantTabs}
        options={{headerShown: false}}
      />

      <Stack.Screen
        name="GuidedInspection"
        component={GuidedInspectionScreen}
        options={{title: 'Guided Inspection'}}
      />

      <Stack.Screen
        name="ReportMaintenance"
        component={ReportMaintenanceScreen}
        options={{title: 'Report Maintenance'}}
      />

      <Stack.Screen
        name="InspectionAvailability"
        component={InspectionAvailabilityScreen}
        options={{title: 'Inspection Availability'}}
      />

      <Stack.Screen
        name="MaintenanceDetail"
        component={MaintenanceDetailScreen}
        options={{title: 'Maintenance Details'}}
      />

      <Stack.Screen
        name="ReviewInspectionPhoto"
        component={ReviewInspectionPhotoScreen}
        options={{title: 'Review Photo'}}
      />

      <Stack.Screen
        name="InspectionSubmitted"
        component={InspectionSubmittedScreen}
        options={{title: 'Inspection Submitted'}}
      />
    </Stack.Navigator>
  );
}
