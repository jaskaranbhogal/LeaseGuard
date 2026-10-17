
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BottomNavigation from '../components/BottomNavigation';
import TenantDashboardScreen from '../screens/tenant/TenantDashboardScreen';
import UnitHistoryScreen from '../screens/tenant/UnitHistoryScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import Button from '../components/Button';
import ScreenContainer from '../components/ScreenContainer';
import DemoNotice from '../components/DemoNotice';
import { useInspection } from '../context/InspectionContext';
import { colors } from '../theme/colors';

import type { TenantTabParamList, TenantStackParamList } from './types';

type PreviousTab = 'Home' | 'Inspections' | 'History';

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
      <Text style={styles.title}>Inspections</Text>
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

function TenantTabBar(props: BottomTabBarProps) {
  return <BottomNavigation {...props} role="tenant" />;
}

export default function TenantTabs() {
  const [previousTab, setPreviousTab] = useState<PreviousTab>('Home');

  return (
    <Tab.Navigator
      tabBar={TenantTabBar}
      screenOptions={{ headerShown: false }}
      screenListeners={({ route }) => ({
        focus: () => {
          if (route.name !== 'Settings') {
            setPreviousTab(route.name);
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={TenantDashboardScreen} />
      <Tab.Screen name="Inspections" component={InspectionsScreen} />
      <Tab.Screen name="History" component={UnitHistoryScreen} />
    
<Tab.Screen name="Settings">
  {({ navigation }) => (
    <SettingsScreen
      previousTab={previousTab}
      onBack={() => navigation.navigate(previousTab)}
    />
  )}
</Tab.Screen>

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
});

