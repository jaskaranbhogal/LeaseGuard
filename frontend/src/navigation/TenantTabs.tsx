
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import BottomNavigation from '../components/BottomNavigation';
import TenantDashboardScreen from '../screens/tenant/TenantDashboardScreen';
import UnitHistoryScreen from '../screens/tenant/UnitHistoryScreen';

export type TenantTabParamList = {
  Home: undefined;
  Inspections: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TenantTabParamList>();

function ComingSoonScreen({title}: {title: string}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        This feature is coming soon.
      </Text>
    </View>
  );
}

function InspectionsScreen() {
  return <ComingSoonScreen title="Inspections" />;
}

function SettingsScreen() {
  return <ComingSoonScreen title="Settings" />;
}

export default function TenantTabs() {
  return (
    <Tab.Navigator
      tabBar={props => (
        <BottomNavigation {...props} role="tenant" />
      )}
      screenOptions={{
        headerShown: false,
      }}>
      <Tab.Screen
        name="Home"
        component={TenantDashboardScreen}
      />

      <Tab.Screen
        name="Inspections"
        component={InspectionsScreen}
      />

      <Tab.Screen
        name="History"
        component={UnitHistoryScreen}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F9FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
