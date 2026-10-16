import { StyleSheet, Text } from 'react-native';
import ScreenContainer from './ScreenContainer';
import Button from './Button';
import { useAuth } from '../context/AuthContext';
import { useAuthRequest } from '../utils/useAuthRequest';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export default function AccountScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const { user, signOut } = useAuth();
  const request = useAuthRequest();
  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.brand}>LeaseGuard</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{message}</Text>
      <Text style={styles.text}>Signed in as {user?.email}</Text>
      <Text style={styles.text}>
        Account type: {user?.role ?? 'Not assigned'}
      </Text>
      {request.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {request.error}
        </Text>
      ) : null}
      <Button
        title="Log out"
        loading={request.loading}
        onPress={() => request.run(signOut, () => {})}
      />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg },
  brand: { color: colors.navy, fontSize: 28, fontWeight: '700' },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  text: { color: colors.label, fontSize: 16, lineHeight: 24 },
  error: { color: colors.error, fontSize: 14 },
});
