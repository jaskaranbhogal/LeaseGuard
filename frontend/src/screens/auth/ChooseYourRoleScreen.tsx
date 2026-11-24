import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LandlordIcon from '../../assets/icons/role-landlord.svg';
import TenantIcon from '../../assets/icons/role-tenant.svg';
import CheckIcon from '../../assets/icons/role-check.svg';
import { useAuth } from '../../context/AuthContext';
import { chooseRole } from '../../services/authService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { UserRole } from '../../types/user';
import { useAuthRequest } from '../../utils/useAuthRequest';
import ScreenContainer from '../../components/ScreenContainer';

const roles: { id: UserRole; title: string; description: string }[] = [
  {
    id: 'landlord',
    title: "I'm a Landlord",
    description: 'Manage properties, invite tenants, and oversee inspections.',
  },
  {
    id: 'tenant',
    title: "I'm a Tenant",
    description:
      'Access your rental, complete inspections, and document property conditions.',
  },
];

export default function ChooseYourRoleScreen() {
  const [selected, setSelected] = useState<UserRole | null>(null);
  const { completeSignIn } = useAuth();
  const request = useAuthRequest();

  function continueWithRole() {
    if (!selected || request.loading) return;
    request.run(
      signal => chooseRole(selected, signal),
      user => completeSignIn(user),
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.introduction}>
            <Text style={styles.brand}>LeaseGuard</Text>
            <View style={styles.prompt}>
              <Text style={styles.title}>How will you use LeaseGuard?</Text>
              <Text style={styles.subtitle}>
                Choose your role to personalize your experience.
              </Text>
            </View>
          </View>

          <View style={styles.roleList} accessibilityRole="radiogroup">
            {roles.map(role => {
              const isSelected = selected === role.id;
              const Icon = role.id === 'landlord' ? LandlordIcon : TenantIcon;
              return (
                <Pressable
                  key={role.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${role.title}. ${role.description}`}
                  accessibilityState={{
                    checked: isSelected,
                    disabled: request.loading,
                  }}
                  disabled={request.loading}
                  onPress={() => {
                    setSelected(role.id);
                    request.clearError();
                  }}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <View style={styles.cardHeading}>
                    <View
                      style={[
                        styles.iconCircle,
                        isSelected && styles.iconCircleSelected,
                      ]}
                    >
                      <Icon width={24} height={24} />
                    </View>
                    <Text style={styles.roleTitle}>{role.title}</Text>
                    <View
                      style={[
                        styles.indicator,
                        isSelected && styles.indicatorSelected,
                      ]}
                    >
                      {isSelected ? <CheckIcon width={16} height={16} /> : null}
                    </View>
                  </View>
                  <Text style={styles.description}>{role.description}</Text>
                </Pressable>
              );
            })}
          </View>
          {request.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {request.error}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{
            disabled: !selected || request.loading,
            busy: request.loading,
          }}
          disabled={!selected || request.loading}
          onPress={continueWithRole}
          style={[
            styles.continueButton,
            selected && styles.continueButtonEnabled,
          ]}
        >
          {request.loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text
              style={[
                styles.continueLabel,
                selected && styles.continueLabelEnabled,
              ]}
            >
              Continue
            </Text>
          )}
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg },
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 26,
  },
  content: { gap: 32 },
  introduction: { gap: 16 },
  brand: {
    color: colors.navy,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: typography.bold,
  },
  prompt: { gap: 10 },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: typography.bold,
  },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  roleList: { gap: 16 },
  card: {
    height: 164,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    padding: 20,
    gap: 14,
  },
  cardSelected: {
    backgroundColor: '#EBF2FF',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: { backgroundColor: colors.white },
  roleTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: typography.semibold,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 0,
  },
  description: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  continueButton: {
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonEnabled: { backgroundColor: colors.primary },
  continueLabel: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: typography.semibold,
  },
  continueLabelEnabled: { color: colors.white },
});
