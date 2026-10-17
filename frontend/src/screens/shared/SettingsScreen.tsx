
import React, { useState } from 'react';
import {
  Alert,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';

type PreviousTab = 'Home' | 'Inspections' | 'History';

type SettingsScreenProps = {
  previousTab: PreviousTab;
  onBack: () => void;
};

export default function SettingsScreen({
  previousTab,
  onBack,
}: SettingsScreenProps) {
  const { signOut } = useAuth();
  const [inspectionReminders, setInspectionReminders] = useState(true);
  const [maintenanceUpdates, setMaintenanceUpdates] = useState(true);
  const [severityAlerts, setSeverityAlerts] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of LeaseGuard?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            if (loggingOut) {
              return;
            }

            setLoggingOut(true);

            try {
              await signOut();
            } catch {
              Alert.alert(
                'Logout Failed',
                'Unable to log out right now. Please try again.',
              );
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer style={styles.content}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={`Go back to ${previousTab}`}
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

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
        NOTIFICATIONS
      </Text>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Inspection Reminders</Text>
        <Switch
          value={inspectionReminders}
          onValueChange={setInspectionReminders}
          trackColor={{ false: '#D1D5DB', true: '#1769AA' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#D1D5DB"
        />
      </View>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Maintenance Updates</Text>
        <Switch
          value={maintenanceUpdates}
          onValueChange={setMaintenanceUpdates}
          trackColor={{ false: '#D1D5DB', true: '#1769AA' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#D1D5DB"
        />
      </View>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>AI / Severity Alerts</Text>
        <Switch
          value={severityAlerts}
          onValueChange={setSeverityAlerts}
          trackColor={{ false: '#D1D5DB', true: '#1769AA' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#D1D5DB"
        />
      </View>

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
        APPEARANCE
      </Text>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Change Theme</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>
        SUPPORT
      </Text>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Help &amp; Support</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuText}>Privacy &amp; Security</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        accessibilityRole="button"
        onPress={handleLogout}
        disabled={loggingOut}
      >
        <Text style={styles.logoutText}>
          {loggingOut ? 'Logging Out...' : 'Log Out'}
        </Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  backButton: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    marginRight: 12,
  },
  backArrow: {
    fontSize: 34,
    fontWeight: '300',
    color: '#172235',
    lineHeight: 38,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#172235',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#607086',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sectionSpacing: {
    marginTop: 24,
  },
  menuItem: {
    minHeight: 64,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 12,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#253247',
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
    color: '#7B8794',
    lineHeight: 30,
  },
  logoutButton: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F04444',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    padding: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D92D2D',
  },
});

