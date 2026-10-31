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
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';
import BrandIcon from '../../components/BrandIcon';
import { useAuth } from '../../context/AuthContext';
import { linkLegacyAccount, synchronizeFirebaseUser } from '../../services/authService';
import { GoogleAccountConflictError, linkGoogleToEmailAccount } from '../../services/firebaseAuthService';
import {
  currentFirebaseUser,
  firebaseErrorMessage,
  resendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
} from '../../services/firebaseAuthService';
import { ApiError } from '../../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [linkRequired, setLinkRequired] = useState(false);
  const [googleConflict, setGoogleConflict] = useState<GoogleAccountConflictError | null>(null);
  const [legacyPassword, setLegacyPassword] = useState('');
  const { completeSignIn } = useAuth();
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const invalidEmail = submitted ? emailError(email) : undefined;
  const invalidPassword =
    submitted && !password ? 'Enter your password.' : undefined;

  async function submit() {
    setSubmitted(true);
    if (emailError(email) || !password) {
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const firebaseUser = await signInWithEmail(email, password);
      if (!firebaseUser.emailVerified) {
        await resendVerificationEmail().catch(() => undefined);
        setNotice('Verify your email using the link we sent, then sign in again.');
        return;
      }
      try {
        completeSignIn(await synchronizeFirebaseUser(await firebaseUser.getIdToken()));
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

  async function continueWithGoogle() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const firebaseUser = await signInWithGoogle();
      if (!firebaseUser) return;
      try {
        completeSignIn(await synchronizeFirebaseUser(await firebaseUser.getIdToken()));
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === 'account_link_required') {
          setLinkRequired(true);
          setError(failure.message);
        } else {
          throw failure;
        }
      }
    } catch (failure) {
      if (failure instanceof GoogleAccountConflictError) {
        setGoogleConflict(failure);
        if (failure.googleEmail) setEmail(failure.googleEmail);
        setError(failure.message);
      } else {
        setError(firebaseErrorMessage(failure));
      }
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
      const user = await linkLegacyAccount(
        await firebaseUser.getIdToken(),
        legacyPassword,
      );
      completeSignIn(user);
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  async function linkGoogleAccount() {
    if (!googleConflict || !legacyPassword) {
      setError('Enter the password for the existing Firebase account.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const firebaseUser = await linkGoogleToEmailAccount(
        email,
        legacyPassword,
        googleConflict.credential,
        googleConflict.googleEmail,
      );
      completeSignIn(await synchronizeFirebaseUser(await firebaseUser.getIdToken()));
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'account_link_required') {
        setLinkRequired(true);
        setError(failure.message);
      } else {
        setError(firebaseErrorMessage(failure));
      }
    } finally {
      setLoading(false);
    }
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
          }}
          error={invalidEmail}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable
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
          }}
          error={invalidPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          editable
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Pressable
          accessibilityRole="link"
          disabled={false}
          style={styles.forgot}
          onPress={() =>
            navigation.navigate('ForgotPassword', { email: email.trim() })
          }
        >
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
        <Button
          title="Login"
          disabled={loading}
          loading={loading}
          onPress={submit}
          style={styles.login}
        />
        {notice ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {notice}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{
            disabled: loading,
            busy: loading,
          }}
          disabled={loading}
          onPress={continueWithGoogle}
          style={[
            styles.socialButton,
            styles.googleButton,
            loading && styles.disabled,
          ]}
        >
          <BrandIcon />
          <Text style={styles.googleLabel}>Sign in with Google</Text>
        </Pressable>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {googleConflict ? (
          <View style={styles.linkAccount}>
            <Text style={styles.notice}>
              This Google email already has a Firebase email account. Sign in to
              that account once to link Google securely.
            </Text>
            <Input
              label="Firebase account password"
              placeholder="Enter your account password"
              value={legacyPassword}
              onChangeText={setLegacyPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable
              returnKeyType="go"
              onSubmitEditing={linkGoogleAccount}
            />
            <Button
              title="Link Google account"
              onPress={linkGoogleAccount}
              loading={loading}
              disabled={loading || !legacyPassword}
            />
          </View>
        ) : null}
        {linkRequired ? (
          <View style={styles.linkAccount}>
            <Text style={styles.notice}>
              Confirm your existing LeaseGuard password to safely link this
              verified email to your current account.
            </Text>
            <Input
              label="Previous LeaseGuard password"
              placeholder="Enter your previous password"
              value={legacyPassword}
              onChangeText={setLegacyPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              editable
              returnKeyType="go"
              onSubmitEditing={linkAccount}
            />
            <Button
              title="Link existing account"
              onPress={linkAccount}
              loading={loading}
              disabled={loading || !legacyPassword}
            />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Register"
          disabled={loading}
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
  googleLabel: {
    flex: 1,
    color: '#3C4043',
    fontSize: 15,
    fontWeight: typography.semibold,
    textAlign: 'center',
  },
  register: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  registerText: { color: colors.label, fontSize: 14, textAlign: 'center' },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  error: { color: colors.error, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  disabled: { opacity: 0.65 },
  linkAccount: { gap: spacing.sm },
});
