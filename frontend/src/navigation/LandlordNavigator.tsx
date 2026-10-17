import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import SettingsScreen from '../screens/shared/SettingsScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';
import AIInspectionReviewScreen from '../screens/landlord/AIInspectionReviewScreen';
import ConditionHistoryScreen from '../screens/landlord/ConditionHistoryScreen';
import LandlordDashboardScreen from '../screens/landlord/LandlordDashboardScreen';
import ScheduleInspectionScreen from '../screens/landlord/ScheduleInspectionScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import type { LandlordStackParamList, LandlordTabParamList } from './types';

const Tab = createBottomTabNavigator<LandlordTabParamList>();
const Stack = createNativeStackNavigator<LandlordStackParamList>();

function HomeStack() {
  return (
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Dashboard" component={LandlordDashboardScreen} />
      <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
      <Stack.Screen
        name="ScheduleInspection"
        component={ScheduleInspectionScreen}
      />
      <Stack.Screen
        name="AIInspectionReview"
        component={AIInspectionReviewScreen}
      />
    </Stack.Navigator>
  );
}

function TabIcon({ letter, focused }: { letter: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconActive]}>
      <Text style={[styles.iconLetter, focused && styles.iconLetterActive]}>
        {letter}
      </Text>
    </View>
  );
}

function iconFor(letter: string) {
  return {
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <TabIcon letter={letter} focused={focused} />
    ),
  };
}

const homeOptions = { title: 'Home', ...iconFor('H') };
const historyOptions = { title: 'History', ...iconFor('T') };
const settingsOptions = { title: 'Settings', ...iconFor('S') };

export default function LandlordNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeStack"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.actionBlue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
      }}>
      <Tab.Screen name="HomeStack" component={HomeStack} options={homeOptions} />
      <Tab.Screen
        name="History"
        component={ConditionHistoryScreen}
        options={historyOptions}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={settingsOptions}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  label: { fontSize: 12, fontWeight: typography.medium },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECEEF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: '#EAF1FE' },
  iconLetter: {
    fontSize: 15,
    fontWeight: typography.bold,
    color: colors.textSecondary,
  },
  iconLetterActive: { color: colors.actionBlue },
});
