import Button from '../../components/Button';
import Header from '../../components/Header';
import ScreenContainer from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import React, { useState } from 'react';
import { StyleSheet, Text, View, Switch, StatusBar } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useAuthRequest } from '../../utils/useAuthRequest';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const request = useAuthRequest();

  const [inspectionReminders, setInspectionReminders] = useState(true);
  const [maintenanceUpdates, setMaintenanceUpdates] = useState(true);
  const [severityAlerts, setSeverityAlerts] = useState(true);

  return (
    <ScreenContainer style={styles.content}>
      <StatusBar barStyle="dark-content" />
      <Header title="Settings" style={styles.header} />

      <Text style={styles.notice}>
        Prototype settings. Notification preferences are local to this screen
        and reset when the screen unmounts or the app restarts. They are not
        saved or synchronized with Django.
      </Text>
      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <View
        style={styles.menuItem}
        accessible
        accessibilityLabel="Profile, unavailable in prototype"
        accessibilityState={{ disabled: true }}
      >
        <Text style={styles.menuText}>Profile</Text>
        <Text style={styles.unavailable}>Unavailable</Text>
      </View>

      <View
        style={styles.menuItem}
        accessible
        accessibilityLabel="Change Password, unavailable in prototype"
        accessibilityState={{ disabled: true }}
      >
        <Text style={styles.menuText}>Change Password</Text>
        <Text style={styles.unavailable}>Unavailable</Text>
      </View>

      <Text style={[styles.sectionTitle, styles.notificationSection]}>
        NOTIFICATIONS
      </Text>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Inspection Reminders</Text>

        <Switch
          accessibilityLabel="Inspection Reminders"
          value={inspectionReminders}
          onValueChange={setInspectionReminders}
          trackColor={{
            false: '#D1D5DB',
            true: colors.primary,
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#D1D5DB"
        />
      </View>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Maintenance Updates</Text>

        <Switch
          accessibilityLabel="Maintenance Updates"
          value={maintenanceUpdates}
          onValueChange={setMaintenanceUpdates}
          trackColor={{
            false: '#D1D5DB',
            true: colors.primary,
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#D1D5DB"
        />
      </View>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>AI / Severity Alerts</Text>

        <Switch
          accessibilityLabel="AI / Severity Alerts"
          value={severityAlerts}
          onValueChange={setSeverityAlerts}
          trackColor={{
            false: '#D1D5DB',
            true: colors.primary,
          }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#D1D5DB"
        />
      </View>

      <Text style={[styles.sectionTitle, styles.appearanceSection]}>
        APPEARANCE
      </Text>

      <View
        style={styles.menuItem}
        accessible
        accessibilityLabel="Change Theme, unavailable in prototype"
        accessibilityState={{ disabled: true }}
      >
        <Text style={styles.menuText}>Change Theme</Text>
        <Text style={styles.unavailable}>Unavailable</Text>
      </View>

      <Text style={[styles.sectionTitle, styles.supportSection]}>SUPPORT</Text>

      <View
        style={styles.menuItem}
        accessible
        accessibilityLabel="Help & Support, unavailable in prototype"
        accessibilityState={{ disabled: true }}
      >
        <Text style={styles.menuText}>Help & Support</Text>
        <Text style={styles.unavailable}>Unavailable</Text>
      </View>

      <View
        style={styles.menuItem}
        accessible
        accessibilityLabel="Privacy & Security, unavailable in prototype"
        accessibilityState={{ disabled: true }}
      >
        <Text style={styles.menuText}>Privacy & Security</Text>
        <Text style={styles.unavailable}>Unavailable</Text>
      </View>

      {request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {request.error}
        </Text>
      ) : null}
      <Button
        title="Log out"
        loading={request.loading}
        variant="outline"
        onPress={() => request.run(signOut, () => {})}
        style={styles.logoutButton}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.label,
    marginBottom: 24,
  },
  unavailable: { fontSize: 12, color: colors.textSecondary },
  header: { marginBottom: 24 },

  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 16,
  },

  notificationSection: {
    marginTop: 24,
  },

  appearanceSection: {
    marginTop: 24,
  },

  supportSection: {
    marginTop: 24,
  },

  menuItem: {
    minHeight: 64,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '400',
    color: colors.text,
  },

  chevron: {
    fontSize: 39,
    fontWeight: '300',
    color: '#7B8794',
    lineHeight: 39,
  },

  logoutButton: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#F04444',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },

  error: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.error,
  },
});
