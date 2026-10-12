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
import { login, logout } from '../../services/authService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { User } from '../../types/user';
import { emailError } from '../../utils/validation';
import { useAuthRequest } from '../../utils/useAuthRequest';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
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
        setUser(authenticated);
      },
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.brand}>LeaseGuard</Text>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>
      {user ? (
        <View style={styles.form}>
          <Text accessibilityRole="alert" style={styles.signedIn}>
            Signed in as {user.email}
          </Text>
          <Text style={styles.subtitle}>
            Your account is authenticated. Dashboard access is not available in
            this build yet.
          </Text>
          <Button
            title="Sign out"
            loading={request.loading}
            onPress={() =>
              request.run(
                signal => logout(signal),
                () => setUser(null),
              )
            }
          />
        </View>
      ) : (
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
      )}
      {user && request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {request.error}
        </Text>
      ) : null}
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
  register: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  registerText: { color: colors.label, fontSize: 14, textAlign: 'center' },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  signedIn: {
    color: colors.success,
    fontSize: 18,
    fontWeight: typography.semibold,
  },
});
