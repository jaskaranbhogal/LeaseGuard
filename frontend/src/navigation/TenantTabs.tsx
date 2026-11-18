import React from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';

import BottomNavigation from '../components/BottomNavigation';
import TenantDashboardScreen from '../screens/tenant/TenantDashboardScreen';

import type { TenantTabParamList, TenantStackParamList } from './types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/shared/SettingsScreen';
import ScreenContainer from '../components/ScreenContainer';
import GuidedRecords from '../components/GuidedRecords';

const Tab = createBottomTabNavigator<TenantTabParamList>();

function InspectionsScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Inspections'>,
  NativeStackScreenProps<TenantStackParamList>
>) {
  return <ScreenContainer><GuidedRecords onOpen={inspectionId => navigation.navigate('GuidedInspection', { inspectionId })} /></ScreenContainer>;

}
function TenantSettingsScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Settings'>,
  NativeStackScreenProps<TenantStackParamList>
>) {
  return (
    <SettingsScreen
      onPrivacySecurity={() => navigation.navigate('PrivacySecurity')}
      onProfile={() => navigation.navigate('Profile')}
    />
  );
}
function TenantTabBar(props: BottomTabBarProps) {
  return <BottomNavigation {...props} role="tenant" />;
}

export default function TenantTabs() {
  return (
    <Tab.Navigator
      tabBar={TenantTabBar}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={TenantDashboardScreen} />

      <Tab.Screen name="Inspections" component={InspectionsScreen} />

      <Tab.Screen name="Settings" component={TenantSettingsScreen} />
    </Tab.Navigator>
  );
}
