import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  StatusBar,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAuthRequest } from '../../utils/useAuthRequest';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const request = useAuthRequest();

  const [inspectionReminders, setInspectionReminders] = useState(true);
  const [maintenanceUpdates, setMaintenanceUpdates] = useState(true);
  const [severityAlerts, setSeverityAlerts] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Settings</Text>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Profile</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Change Password</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, styles.notificationSection]}>
          NOTIFICATIONS
        </Text>

        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Inspection Reminders</Text>

          <Switch
            value={inspectionReminders}
            onValueChange={setInspectionReminders}
            trackColor={{
              false: '#D1D5DB',
              true: '#1769AA',
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        </View>

        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Maintenance Updates</Text>

          <Switch
            value={maintenanceUpdates}
            onValueChange={setMaintenanceUpdates}
            trackColor={{
              false: '#D1D5DB',
              true: '#1769AA',
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        </View>

        <View style={styles.menuItem}>
          <Text style={styles.menuText}>AI / Severity Alerts</Text>

          <Switch
            value={severityAlerts}
            onValueChange={setSeverityAlerts}
            trackColor={{
              false: '#D1D5DB',
              true: '#1769AA',
            }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        </View>

        <Text style={[styles.sectionTitle, styles.appearanceSection]}>
          APPEARANCE
        </Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Change Theme</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, styles.supportSection]}>
          SUPPORT
        </Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Help & Support</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Privacy & Security</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {request.error ? (
          <Text accessibilityRole="alert" style={styles.logoutText}>{request.error}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.logoutButton}
          disabled={request.loading}
          onPress={() => request.run(signOut, () => {})}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },

  container: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },

  content: {
    paddingHorizontal: 46,
    paddingTop: 22,
    paddingBottom: 32,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },

  backButton: {
    width: 34,
    height: 44,
    justifyContent: 'center',
    marginRight: 20,
  },

  backArrow: {
    fontSize: 43,
    fontWeight: '300',
    color: '#172235',
    lineHeight: 43,
  },

  title: {
    fontSize: 46,
    fontWeight: '700',
    color: '#172235',
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#607086',
    marginBottom: 16,
  },

  notificationSection: {
    marginTop: 38,
  },

  appearanceSection: {
    marginTop: 38,
  },

  supportSection: {
    marginTop: 38,
  },

  menuItem: {
    minHeight: 86,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 16,
    marginBottom: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuText: {
    fontSize: 23,
    fontWeight: '400',
    color: '#253247',
  },

  chevron: {
    fontSize: 39,
    fontWeight: '300',
    color: '#7B8794',
    lineHeight: 39,
  },

  logoutButton: {
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F04444',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36, 
  },

  logoutText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#D92D2D',
  },
});