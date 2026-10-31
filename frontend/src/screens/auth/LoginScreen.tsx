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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const invalidEmail = submitted ? emailError(email) : undefined;
  const invalidPassword =
    submitted && !password ? 'Enter your password.' : undefined;

  function submit() {
    setSubmitted(true);
    if (emailError(email) || !password) {
      return;
    }
    Keyboard.dismiss();
    setSubmitted(true);
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
          disabled
          onPress={submit}
          style={styles.login}
        />
        <Text accessibilityRole="text" style={styles.notice}>
          Email and password sign-in will be available when Firebase is connected.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{
            disabled: true,
          }}
          disabled
          style={[styles.socialButton, styles.googleButton]}
        >
          <BrandIcon />
          <Text style={styles.googleLabel}>Sign in with Google</Text>
        </Pressable>
        <Text accessibilityRole="text" style={styles.notice}>
          Google sign-in will be available when Firebase is connected.
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Register"
          disabled={false}
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
});
