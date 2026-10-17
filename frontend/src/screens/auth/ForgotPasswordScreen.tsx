import Header from '../../components/Header';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import type { AuthStackParamList } from '../../navigation/types';
import { requestPasswordReset } from '../../services/authService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';
import { useAuthRequest } from '../../utils/useAuthRequest';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [submitted, setSubmitted] = useState(false);
  const request = useAuthRequest();
  function submit() {
    setSubmitted(true);
    if (emailError(email)) {
      return;
    }
    Keyboard.dismiss();
    const address = email.trim();
    request.run(
      signal => requestPasswordReset(address, signal),
      delivery =>
        navigation.replace('ResetEmailSent', { email: address, delivery }),
    );
  }
  return (
    <ScreenContainer>
      <Header
        title="Reset password"
        subtitle="We’ll email you a secure password-reset link."
        style={styles.header}
        titleStyle={styles.title}
        subtitleStyle={styles.subtitle}
      />
      <View style={styles.body}>
        <Input
          label="Email address"
          placeholder="Enter your email"
          value={email}
          onChangeText={value => {
            setEmail(value);
            request.clearError();
          }}
          error={submitted ? emailError(email) : undefined}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!request.loading}
          returnKeyType="send"
          onSubmitEditing={submit}
        />
        {request.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {request.error}
          </Text>
        ) : null}
        <Button
          title="Send reset email"
          variant="reset"
          loading={request.loading}
          onPress={submit}
          style={styles.send}
        />
        <Button
          title="Back to sign in"
          variant="outline"
          disabled={request.loading}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
          }
        />
        <Text style={styles.note}>
          For your privacy, we won’t confirm whether an account exists for this
          email address.
        </Text>
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.headerNavy,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: 80,
    minHeight: 210,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: typography.bold,
    marginBottom: spacing.md,
  },
  subtitle: { color: colors.headerSubtitle, fontSize: 15, lineHeight: 22 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: spacing.xl,
    gap: 12,
  },
  send: { marginTop: 20 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 28,
  },
});
