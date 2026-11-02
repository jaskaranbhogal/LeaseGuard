import {
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Header from '../../components/Header';
import ScreenContainer from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function PrivacySecurityScreen() {
  // Shared by both roles, so use the generic navigation object.
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  // Landlord: SettingsHome -> PrivacySecurity (SettingsStack)
  // Tenant: TenantTabs (Settings tab) -> PrivacySecurity (TenantStack)
  // Both push this screen, so goBack() returns to the right place.
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // 'PrivacyPolicy' is registered in both the landlord settings stack
  // and the tenant stack.
  const openPrivacyPolicy = () => navigation.navigate('PrivacyPolicy');

  const openCameraSettings = () => {
    Alert.alert(
      'Camera permission',
      'You can turn camera access on or off for LeaseGuard in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  };

  return (
    <ScreenContainer style={styles.container}>
      <Header
        title="Privacy & security"
        onBack={handleBack}
        titleStyle={styles.title}
        style={styles.header}
      />

      <View>
        {/* Photos and videos */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your photos and videos</Text>
          <Text style={styles.infoText}>
            Stored securely and visible only to the landlord and tenant of the
            unit they belong to.
          </Text>
        </View>

        {/* Privacy policy */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={openPrivacyPolicy}
          accessibilityRole="button"
          accessibilityLabel="Privacy policy"
        >
          <Text style={styles.menuText}>Privacy policy</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Consent (status removed, not implemented yet) */}
        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Consent and data handling</Text>
        </View>

        {/* Camera permission */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={openCameraSettings}
          accessibilityRole="button"
          accessibilityLabel="Camera permission"
        >
          <Text style={styles.menuText}>Camera permission</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          AI comparisons are advisory. Landlords and tenants make the final
          decisions.
        </Text>
      </View>
    </ScreenContainer>
  );
}

// Sizes and spacing mirror SettingsScreen so the screens feel consistent.
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // 24px like Settings, Profile, Login, and Register (Header defaults to 32).
  title: {
    fontSize: 24,
  },

  header: {
    marginBottom: spacing.lg,
  },

  infoCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: 14,
  },

  infoTitle: {
    fontSize: 17,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.label,
  },

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

  chevron: {
    fontSize: 39,
    fontWeight: '300',
    color: '#7B8794',
    lineHeight: 39,
  },

  disclaimer: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});