import Header from '../../components/Header';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import { linkLegacyAccount, synchronizeFirebaseUser } from '../../services/authService';
import {
  currentFirebaseUser,
  firebaseErrorMessage,
  refreshEmailVerification,
  registerWithEmail,
  resendVerificationEmail,
} from '../../services/firebaseAuthService';
import { ApiError } from '../../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [linkRequired, setLinkRequired] = useState(false);
  const [legacyPassword, setLegacyPassword] = useState('');
  const { completeSignIn } = useAuth();
  const emailInput = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmInput = useRef<ComponentRef<typeof TextInput>>(null);
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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function submit() {
    setSubmitted(true);
    if (invalidName || invalidEmail || invalidPassword || invalidConfirmation) {
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      const result = await registerWithEmail(email, password, name);
      setPendingVerification(true);
      setVerificationSent(result.verificationSent);
      setResendCooldown(result.verificationSent ? 30 : 0);
      if (!result.profileUpdated) {
        setError('Your account was created, but we could not save your name. You can update it later.');
      }
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setLoading(true);
    setError('');
    try {
      await resendVerificationEmail();
      setVerificationSent(true);
      setResendCooldown(30);
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  async function checkVerification() {
    setLoading(true);
    setError('');
    try {
      const firebaseUser = await refreshEmailVerification();
      if (!firebaseUser) {
        setError('Your email is not verified yet. Open the link we sent, then try again.');
        return;
      }
      try {
        completeSignIn(await synchronizeFirebaseUser(await firebaseUser.getIdToken(true)));
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === 'account_link_required') {
          setLinkRequired(true);
          setError(failure.message);
        } else {
          throw failure;
        }
      }
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  async function linkAccount() {
    const firebaseUser = currentFirebaseUser();
    if (!firebaseUser || !legacyPassword) {
      setError('Enter the password for your existing LeaseGuard account.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      completeSignIn(await linkLegacyAccount(await firebaseUser.getIdToken(), legacyPassword));
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }
  function signIn() {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.brand}>LeaseGuard</Text>
      <Header title="Create an account" titleStyle={styles.title} />
      <Text style={styles.subtitle}>Get started with LeaseGuard</Text>
      <View style={styles.form}>
        <Input
          label="Full name"
          placeholder="Enter your full name"
          value={name}
          onChangeText={value => {
            setName(value);
          }}
          error={submitted ? invalidName : undefined}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          editable={!pendingVerification}
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
          }}
          error={submitted ? invalidEmail : undefined}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!pendingVerification}
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
          }}
          error={submitted ? invalidPassword : undefined}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!pendingVerification}
          returnKeyType="next"
          onSubmitEditing={() => confirmInput.current?.focus()}
        />
        <Text style={styles.hint}>
          Use at least 8 characters. Avoid common passwords, only numbers, and
          passwords similar to your name or email.
        </Text>
        <Input
          ref={confirmInput}
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={value => {
            setConfirmPassword(value);
          }}
          error={submitted ? invalidConfirmation : undefined}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!pendingVerification}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {pendingVerification ? (
          <View style={styles.verification}>
            <Text style={styles.notice}>
              {verificationSent
                ? `We sent a verification link to ${email.trim()}. Verify your email, then return here.`
                : `Your account was created, but we could not send the verification email to ${email.trim()}. Try sending it again.`}
            </Text>
            <Button
              title={resendCooldown ? `Resend email in ${resendCooldown}s` : 'Resend verification email'}
              onPress={resendVerification}
              loading={loading && !linkRequired}
              disabled={loading || resendCooldown > 0}
              variant="outline"
            />
            <Button
              title="I verified my email"
              onPress={checkVerification}
              loading={loading && !linkRequired}
              disabled={loading}
            />
          </View>
        ) : (
          <Button title="Create account" disabled={loading} loading={loading} onPress={submit} />
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {linkRequired ? (
          <View style={styles.verification}>
            <Input
              label="Previous LeaseGuard password"
              placeholder="Enter your previous password"
              value={legacyPassword}
              onChangeText={setLegacyPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable
            />
            <Button title="Link existing account" onPress={linkAccount} loading={loading} disabled={loading || !legacyPassword} />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Sign in"
          disabled={loading}
          style={styles.signIn}
          onPress={signIn}
        >
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
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
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  error: { color: colors.error, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  verification: { gap: spacing.md },
  signIn: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.primary, fontSize: 14, textAlign: 'center' },
});
