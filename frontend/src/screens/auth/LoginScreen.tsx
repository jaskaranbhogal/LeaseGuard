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
import Button from '../../components/Button';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import type { AuthStackParamList } from '../../navigation/types';
import { login } from '../../services/authService';
import { signInWithGoogle } from '../../services/googleAuthService';
import { signInWithApple } from '../../services/appleAuthService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';
import { emailError } from '../../utils/validation';
import { useAuthRequest } from '../../utils/useAuthRequest';
import BrandIcon from '../../components/BrandIcon';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { completeSignIn } = useAuth();
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const request = useAuthRequest();
  const invalidEmail = submitted ? emailError(email) : undefined;
  const invalidPassword =
    submitted && !password ? 'Enter your password.' : undefined;

  function submit() {
    setSubmitted(true);
    if (emailError(email) || !password) {
      return;
    }
    Keyboard.dismiss();
    request.run(
      signal => login(email, password, signal),
      authenticated => {
        setPassword('');
        setSubmitted(false);
        completeSignIn(authenticated);
      },
    );
  }

  function startGoogleSignIn() {
    request.run(
      signal => signInWithGoogle(signal),
      user => {
        if (user) completeSignIn(user);
      },
    );
  }

  function startAppleSignIn() {
    request.run(
      signal => signInWithApple(signal),
      user => {
        if (user) completeSignIn(user);
      },
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.brand}>LeaseGuard</Text>
      <Header title="Welcome back" titleStyle={styles.title} />
      <Text style={styles.subtitle}>Sign in to your account</Text>
      <View style={styles.form}>
        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={value => {
            setEmail(value);
            request.clearError();
          }}
          error={invalidEmail}
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
          placeholder="Enter your password"
          value={password}
          onChangeText={value => {
            setPassword(value);
            request.clearError();
          }}
          error={invalidPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          editable={!request.loading}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Pressable
          accessibilityRole="link"
          disabled={request.loading}
          style={styles.forgot}
          onPress={() =>
            navigation.navigate('ForgotPassword', { email: email.trim() })
          }
        >
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
        {request.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {request.error}
          </Text>
        ) : null}
        <Button
          title="Login"
          loading={request.loading}
          onPress={submit}
          style={styles.login}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{
            disabled: request.loading,
            busy: request.loading,
          }}
          disabled={request.loading}
          onPress={startGoogleSignIn}
          style={[styles.socialButton, styles.googleButton]}
        >
          {request.loading ? (
            <Text style={styles.googleLabel}>Connecting…</Text>
          ) : (
            <>
              <BrandIcon brand="google" />
              <Text style={styles.googleLabel}>Sign in with Google</Text>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple ID"
          accessibilityState={{
            disabled: request.loading,
            busy: request.loading,
          }}
          disabled={request.loading}
          onPress={startAppleSignIn}
          style={[styles.socialButton, styles.appleButton]}
        >
          {request.loading ? (
            <Text style={styles.appleLabel}>Connecting…</Text>
          ) : (
            <>
              <BrandIcon brand="apple" />
              <Text style={styles.appleLabel}>Sign in with Apple ID</Text>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Register"
          disabled={request.loading}
          style={styles.register}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>
            Don’t have an account? Register
          </Text>
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
  form: { marginTop: 44, gap: spacing.md },
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: -12,
  },
  link: { color: colors.primary, fontSize: 14, fontWeight: typography.medium },
  login: { marginTop: 0 },
  socialButton: {
    minHeight: 50,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  appleButton: { backgroundColor: '#000000' },
  googleLabel: {
    flex: 1,
    color: '#3C4043',
    fontSize: 15,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  appleLabel: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  register: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  registerText: { color: colors.label, fontSize: 14, textAlign: 'center' },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  signedIn: {
    color: colors.success,
    fontSize: 18,
    fontWeight: typography.semibold,
  },
});
