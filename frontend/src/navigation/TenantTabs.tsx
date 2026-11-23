import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import Button from '../components/Button';
import ScreenTitle from '../components/ScreenTitle';
import { layout } from '../theme/layout';

const Tab = createBottomTabNavigator<TenantTabParamList>();

function InspectionsScreen({
  navigation,
}: CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Inspections'>,
  NativeStackScreenProps<TenantStackParamList>
>) {
  return (
    <ScreenContainer style={styles.inspections}>
      <ScreenTitle
        title="Inspections"
        subtitle="Your assigned photo inspections and saved progress."
      />
      <GuidedRecords
        tenant
        onOpen={inspectionId =>
          navigation.navigate('GuidedInspection', { inspectionId })
        }
      />
      <View style={styles.help}>
        <Text style={styles.title}>Need a repair?</Text>
        <Text style={layout.muted}>
          You can report maintenance without an assigned inspection. A verified
          unit assignment is required.
        </Text>
        <Button
          title="Report maintenance"
          onPress={() => navigation.navigate('ReportMaintenance')}
        />
      </View>
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
  inspections: { padding: 24, gap: 24 },
  help: { ...layout.card },
  title: { ...layout.sectionTitle },
});
