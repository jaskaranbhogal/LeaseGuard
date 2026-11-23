import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionButton from '../../components/ActionButton';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export default function InviteEmailScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'InviteEmail'>) {
  return (
    <ScreenContainer style={styles.container}>
      <ScreenTitle title="Join your unit" onBack={() => navigation.goBack()} />
      <View style={styles.card}>
        <Text style={styles.heading} accessibilityRole="header">
          Have an invitation?
        </Text>
        <Text style={styles.description}>
          Create an account using the email your landlord invited. After signing
          in, enter the single-use code from your invitation email to join your
          unit.
        </Text>
        <View style={styles.actions}>
          <ActionButton
            title="Create tenant account"
            onPress={() => navigation.navigate('Register')}
          />
          <ActionButton
            title="Sign in"
            variant="secondary"
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  heading: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.muted,
  },
  actions: {
    gap: spacing.sm + spacing.xs,
    marginTop: spacing.sm,
  },
});
