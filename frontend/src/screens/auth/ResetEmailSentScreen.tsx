import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import ScreenContainer from '../../components/ScreenContainer';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetEmailSent'>;
export default function ResetEmailSentScreen({ navigation, route }: Props) {
  const { email, delivery } = route.params;
  const preview = delivery === 'console';
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.circle} accessible={false}>
          <Text style={styles.envelope}>✉️</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Check your email
        </Text>
        <Text style={styles.subtitle}>
          {preview
            ? 'Reset request accepted for'
            : 'If an account exists, a password-reset link will be sent to'}
        </Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      <View style={styles.body}>
        <Button
          title="Return to sign in"
          variant="reset"
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
          }
        />
        <Text style={styles.note}>
          {preview
            ? 'Email delivery is not configured in this development build. No email was sent. Eligible reset links appear in the backend worker console.'
            : 'The link will open a secure page to choose a new password. Check your spam folder too.'}
        </Text>
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.success,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    alignItems: 'center',
    paddingTop: 68,
    paddingBottom: 18,
    paddingHorizontal: spacing.lg,
    minHeight: 300,
  },
  circle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  envelope: { fontSize: 36 },
  title: {
    color: colors.white,
    fontSize: 26,
    fontWeight: typography.bold,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  email: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 20,
  },
});
