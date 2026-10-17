import Header from '../../components/Header';
import { useRef, useState, type ComponentRef } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { UserRole } from '../../types/user';
import Button from '../../components/Button';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import type { AuthStackParamList } from '../../navigation/types';
import { register } from '../../services/authService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';
import { useAuthRequest } from '../../utils/useAuthRequest';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
export default function RegisterScreen({ navigation }: Props) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const emailInput = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmInput = useRef<ComponentRef<typeof TextInput>>(null);
  const request = useAuthRequest();
  const invalidName =
    !name.trim() || name.trim().length > 150
      ? 'Enter your full name (up to 150 characters).'
      : undefined;
  const invalidEmail = emailError(email);
  const invalidPassword =
    password.length < 8
      ? 'Use at least 8 characters.'
      : password.length > 4096
      ? 'Use no more than 4096 characters.'
      : undefined;
  const invalidConfirmation = !confirmPassword
    ? 'Confirm your password.'
    : password !== confirmPassword
    ? 'Passwords do not match.'
    : undefined;

  function submit() {
    setSubmitted(true);
    if (
      !role ||
      invalidName ||
      invalidEmail ||
      invalidPassword ||
      invalidConfirmation
    ) {
      return;
    }
    Keyboard.dismiss();
    request.run(
      signal =>
        register({ name, email, password, confirmPassword, role }, signal),
      user => {
        setPassword('');
        setConfirmPassword('');
        setCreatedEmail(user.email);
      },
    );
  }
  function signIn() {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.brand}>LeaseGuard</Text>
      <Header
        title={createdEmail ? 'Account created' : 'Create an account'}
        titleStyle={styles.title}
      />
      {createdEmail ? (
        <View style={styles.form}>
          <Text accessibilityRole="alert" style={styles.subtitle}>
            Your account for {createdEmail} is ready. Sign in to continue.
          </Text>
          <Button title="Back to sign in" onPress={signIn} />
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>Get started with LeaseGuard</Text>
          <View style={styles.form}>
            <Text style={styles.roleLabel}>Select role</Text>
            <View style={styles.roles} accessibilityRole="radiogroup">
              {(['landlord', 'tenant'] as const).map(option => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityLabel={
                    option === 'tenant' ? 'Tenant' : 'Landlord'
                  }
                  accessibilityState={{
                    checked: role === option,
                    disabled: request.loading,
                  }}
                  disabled={request.loading}
                  onPress={() => {
                    setRole(option);
                    request.clearError();
                  }}
                  style={[
                    styles.roleCard,
                    role === option && styles.selectedRole,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      role === option && styles.selectedRoleText,
                    ]}
                  >
                    <Text
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      {option === 'tenant' ? '⌂' : '▥'}{' '}
                    </Text>
                    {option === 'tenant' ? 'Tenant' : 'Landlord'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {submitted && !role ? (
              <Text accessibilityRole="alert" style={styles.error}>
                Select Tenant or Landlord.
              </Text>
            ) : null}
            <Input
              label="Full name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={value => {
                setName(value);
                request.clearError();
              }}
              error={submitted ? invalidName : undefined}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!request.loading}
              returnKeyType="next"
              onSubmitEditing={() => emailInput.current?.focus()}
            />
            <Input
              ref={emailInput}
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={value => {
                setEmail(value);
                request.clearError();
              }}
              error={submitted ? invalidEmail : undefined}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!request.loading}
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
            />
            <Input
              ref={passwordInput}
              label="Password"
              placeholder="Create a password"
              value={password}
              onChangeText={value => {
                setPassword(value);
                request.clearError();
              }}
              error={submitted ? invalidPassword : undefined}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!request.loading}
              returnKeyType="next"
              onSubmitEditing={() => confirmInput.current?.focus()}
            />
            <Text style={styles.hint}>
              Use at least 8 characters. Avoid common passwords, only numbers,
              and passwords similar to your name or email.
            </Text>
            <Input
              ref={confirmInput}
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={value => {
                setConfirmPassword(value);
                request.clearError();
              }}
              error={submitted ? invalidConfirmation : undefined}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!request.loading}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {request.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {request.error}
              </Text>
            ) : null}
            <Button
              title="Create account"
              loading={request.loading}
              onPress={submit}
            />
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Sign in"
              disabled={request.loading}
              style={styles.signIn}
              onPress={signIn}
            >
              <Text style={styles.link}>Already have an account? Sign in</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  brand: {
    fontSize: 28,
    fontWeight: typography.bold,
    color: colors.navy,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  form: { marginTop: spacing.xl, gap: spacing.md },
  roleLabel: {
    color: colors.label,
    fontSize: 14,
    fontWeight: typography.semibold,
  },
  roles: { flexDirection: 'row', gap: 10 },
  roleCard: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  selectedRole: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  roleText: {
    color: colors.label,
    fontSize: 15,
    fontWeight: typography.semibold,
  },
  selectedRoleText: { color: colors.white },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  signIn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 14, textAlign: 'center' },
});
