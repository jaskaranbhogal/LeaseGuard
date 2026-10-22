import React from 'react';
import Header from '../components/Header';
import { StyleSheet } from 'react-native';
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
import Button from '../components/Button';
import ScreenContainer from '../components/ScreenContainer';
import DemoNotice from '../components/DemoNotice';
import { useInspection } from '../context/InspectionContext';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator<TenantTabParamList>();

function InspectionsScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Inspections'>,
  NativeStackScreenProps<TenantStackParamList>
>) {
  const inspection = useInspection();
  return (
    <ScreenContainer style={styles.container}>
      <Header title="Inspections" titleStyle={styles.title} />
      <DemoNotice />
      <Button
        title={
          inspection.complete
            ? 'Start another demo'
            : 'Continue inspection demo'
        }
        onPress={() => {
          if (inspection.complete) {
            inspection.restart();
          }
          navigation.navigate('GuidedInspection');
        }}
      />
      <Button
        title="Choose demo availability"
        onPress={() => navigation.navigate('InspectionAvailability')}
      />
    </ScreenContainer>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#131824',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#5E6B80',
  },
});
