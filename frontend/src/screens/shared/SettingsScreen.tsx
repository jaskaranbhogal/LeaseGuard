import Button from '../../components/Button';
import Header from '../../components/Header';
import ScreenContainer from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useAuthRequest } from '../../utils/useAuthRequest';
// Colors that are not in colors.ts yet (same values as before).
const SWITCH_OFF = '#D1D5DB';
const CHEVRON = '#7B8794';
const LOGOUT_BORDER = '#F04444';
const LOGOUT_BACKGROUND = '#FFF5F5';

type SettingsScreenProps = {
  onPrivacySecurity?: () => void;
  onProfile?: () => void;
};
export default function SettingsScreen({
  onPrivacySecurity,
  onProfile,
}: SettingsScreenProps) {
  const { signOut } = useAuth();
  const request = useAuthRequest();

  const [inspectionReminders, setInspectionReminders] = useState(true);
  const [maintenanceUpdates, setMaintenanceUpdates] = useState(true);
  const [severityAlerts, setSeverityAlerts] = useState(true);

  return (
    <ScreenContainer style={styles.content}>
      <StatusBar barStyle="dark-content" />
      <Header title="Settings" titleStyle={styles.title} style={styles.header} />

      <Text style={styles.notice}>
        Prototype settings. Notification preferences are local to this screen
        and reset when the screen unmounts or the app restarts. They are not
        saved or synchronized with Django.
      </Text>
      <Text style={styles.sectionTitle}>ACCOUNT</Text>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={onProfile}
        accessibilityRole="button"
        accessibilityLabel="Profile"
      >
        <Text style={styles.menuText}>Profile</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

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
            false: SWITCH_OFF,
            true: colors.primary,
          }}
          thumbColor={colors.white}
          ios_backgroundColor={SWITCH_OFF}
        />
      </View>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>Maintenance Updates</Text>

        <Switch
          accessibilityLabel="Maintenance Updates"
          value={maintenanceUpdates}
          onValueChange={setMaintenanceUpdates}
          trackColor={{
            false: SWITCH_OFF,
            true: colors.primary,
          }}
          thumbColor={colors.white}
          ios_backgroundColor={SWITCH_OFF}
        />
      </View>

      <View style={styles.menuItem}>
        <Text style={styles.menuText}>AI / Severity Alerts</Text>

        <Switch
          accessibilityLabel="AI / Severity Alerts"
          value={severityAlerts}
          onValueChange={setSeverityAlerts}
          trackColor={{
            false: SWITCH_OFF,
            true: colors.primary,
          }}
          thumbColor={colors.white}
          ios_backgroundColor={SWITCH_OFF}
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
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPrivacySecurity}
        accessibilityRole="button"
        accessibilityLabel="Privacy & Security"
      >
        <Text style={styles.menuText}>Privacy & Security</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // 24px like Login, Register, Inspections, and Profile (Header defaults to 32).
  title: { fontSize: 24 },

  header: { marginBottom: spacing.lg },

  notice: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.label,
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  notificationSection: { marginTop: spacing.lg },
  appearanceSection: { marginTop: spacing.lg },
  supportSection: { marginTop: spacing.lg },

  menuItem: {
    minHeight: 64,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginBottom: 14,
    paddingHorizontal: spacing.md,
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
    fontWeight: typography.regular,
    color: colors.text,
  },

  unavailable: { fontSize: 12, color: colors.textSecondary },

  chevron: {
    fontSize: 39,
    fontWeight: '300',
    color: CHEVRON,
    lineHeight: 39,
  },

  logoutButton: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: LOGOUT_BORDER,
    backgroundColor: LOGOUT_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
  },

  error: {
    fontSize: 18,
    fontWeight: typography.semibold,
    color: colors.error,
  },
});