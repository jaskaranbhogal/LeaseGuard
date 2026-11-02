import { useNavigation } from '@react-navigation/native';
import { useRef, useState, type ComponentRef } from 'react';
import { Alert, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';

// Read-only field tint from the mockup (not in colors.ts yet).
const READ_ONLY_BG = '#EAF0F6';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const emailInput = useRef<ComponentRef<typeof TextInput>>(null);
  const currentInput = useRef<ComponentRef<typeof TextInput>>(null);
  const newInput = useRef<ComponentRef<typeof TextInput>>(null);

  const roleLabel =
    user?.role === 'landlord'
      ? 'Landlord'
      : user?.role === 'tenant'
      ? 'Tenant'
      : '';

  // Validation rules mirror RegisterScreen.
  const invalidName =
    !name.trim() || name.trim().length > 150
      ? 'Enter your full name (up to 150 characters).'
      : undefined;
  const invalidEmail = emailError(email);

  // Password fields are optional, but if either is filled both are required.
  const changingPassword = Boolean(currentPassword || newPassword);
  const invalidCurrent =
    changingPassword && !currentPassword
      ? 'Enter your current password.'
      : undefined;
  const invalidNew = !changingPassword
    ? undefined
    : newPassword.length < 8
    ? 'Use at least 8 characters.'
    : newPassword.length > 4096
    ? 'Use no more than 4096 characters.'
    : undefined;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleSave = () => {
    setSubmitted(true);
    if (invalidName || invalidEmail || invalidCurrent || invalidNew) {
      return;
    }
    Keyboard.dismiss();

    // TODO: call the backend once profile and change-password endpoints exist.
    // The Django API currently only exposes login, register, logout, session,
    // and password reset, so nothing is saved yet.
    Alert.alert(
      'Demo only',
      'Profile changes are not saved yet. Nothing was sent to the server.',
    );
  };

  return (
    <ScreenContainer style={styles.container}>
      <Header
        title="Profile"
        onBack={handleBack}
        titleStyle={styles.title}
        style={styles.header}
      />

      <View style={styles.form}>
        <Input
          label="Full name"
          placeholder="Enter your full name"
          value={name}
          onChangeText={setName}
          error={submitted ? invalidName : undefined}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailInput.current?.focus()}
        />

        <Input
          ref={emailInput}
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          error={submitted ? invalidEmail : undefined}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => currentInput.current?.focus()}
        />

        <View style={styles.readOnlyGroup}>
          <Text style={styles.readOnlyLabel}>Role</Text>
          <View
            style={styles.readOnlyField}
            accessible
            accessibilityLabel={`Role, ${roleLabel}, cannot be changed`}
          >
            <Text style={styles.readOnlyText}>{roleLabel}</Text>
          </View>
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Change password
        </Text>

        <Input
          ref={currentInput}
          label="Current password"
          placeholder="Enter current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          error={submitted ? invalidCurrent : undefined}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => newInput.current?.focus()}
        />

        <Input
          ref={newInput}
          label="New password"
          placeholder="Enter new password"
          value={newPassword}
          onChangeText={setNewPassword}
          error={submitted ? invalidNew : undefined}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSave}
        />

        <Button
          title="Save changes"
          onPress={handleSave}
          style={styles.saveButton}
        />
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

  header: {
    marginBottom: spacing.md,
  },

  // The mockup shows a 24px title, smaller than Header's 32px default.
  title: {
    fontSize: 24,
  },

  form: {
    gap: spacing.md,
  },

  readOnlyGroup: {
    gap: spacing.xs,
  },

  readOnlyLabel: {
    color: colors.label,
    fontSize: 14,
    fontWeight: typography.semibold,
  },

  readOnlyField: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: READ_ONLY_BG,
  },

  readOnlyText: {
    fontSize: 15,
    color: colors.textSecondary,
  },

  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: 18,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },

  saveButton: {
    marginTop: spacing.sm,
  },
});