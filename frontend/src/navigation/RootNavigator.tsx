import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AccountScreen from '../components/AccountScreen';
import Button from '../components/Button';
import LoadingScreen from '../screens/auth/LoadingScreen';
import { colors } from '../theme/colors';
import AuthNavigator from './AuthNavigator';
import TenantNavigator from './TenantNavigator';
import LandlordNavigator from './LandlordNavigator';

export default function RootNavigator() {
  const { user, checking, sessionError, refreshSession, showLogin } = useAuth();
  const [splashReady, setSplashReady] = useState(false);
  const finishSplash = useCallback(() => setSplashReady(true), []);
  if (!splashReady || (checking && !user)) {
    return <LoadingScreen onReady={finishSplash} />;
  }
  return (
    <View style={styles.container}>
      <View
        style={styles.container}
        pointerEvents={checking || sessionError ? 'none' : 'auto'}
        accessibilityElementsHidden={Boolean(checking || sessionError)}
        importantForAccessibility={
          checking || sessionError ? 'no-hide-descendants' : 'auto'
        }
      >
        {user ? (
          user.role === 'tenant' ? (
            <TenantNavigator key={user.id} />
          ) : user.role === 'landlord' ? (
            <LandlordNavigator key={user.id} />
          ) : (
            <AccountScreen
              title="Account type not assigned"
              message="Your existing account has no tenant or landlord role. Contact the LeaseGuard team to assign the correct account type before using a dashboard."
            />
          )
        ) : (
          <AuthNavigator />
        )}
      </View>
      {checking || sessionError ? (
        <View style={styles.overlay} accessibilityViewIsModal>
          {checking ? (
            <ActivityIndicator
              accessibilityLabel="Checking your session"
              color={colors.primary}
            />
          ) : (
            <>
              <Text accessibilityRole="alert" style={styles.error}>
                {sessionError}
              </Text>
              <Button
                title="Retry session check"
                onPress={() => {
                  refreshSession();
                }}
              />
              <Button title="Return to sign in" onPress={showLogin} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  error: { color: colors.error, fontSize: 16, lineHeight: 24 },
});
