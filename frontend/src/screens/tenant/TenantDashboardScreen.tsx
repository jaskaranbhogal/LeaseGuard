import { useCallback } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import {
  useFocusEffect,
  type CompositeScreenProps,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  TenantStackParamList,
  TenantTabParamList,
} from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionButton from '../../components/ActionButton';
import NotificationBell from '../../components/NotificationBell';
import GuidedRecords from '../../components/GuidedRecords';
import { MaintenanceRecords } from '../../components/MaintenanceRecords';
import { useAuth } from '../../context/AuthContext';
import { useTenantDemo } from '../../context/TenantDemoContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
type Props = CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Home'>,
  NativeStackScreenProps<TenantStackParamList>
>;
export default function TenantDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { unit, error, refresh } = useTenantDemo();
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title={`Hi, ${user?.name?.split(' ')[0] || 'tenant'}`}
        subtitle={
          unit ? `${unit.street} · Unit ${unit.unit}` : 'No unit linked yet'
        }
        right={
          <NotificationBell
            onPress={() => navigation.navigate('Notifications')}
          />
        }
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!unit && (
        <View style={styles.card}>
          <Text style={styles.title}>Waiting for an invite</Text>
          <Text style={styles.body}>
            Ask your landlord to invite {user?.email}. Sign in with that email
            and enter the invitation code to join your unit.
          </Text>
          <ActionButton title="Check again" onPress={refresh} />
        </View>
      )}
      {unit && (
        <ActionButton
          title="View move-in baseline"
          variant="secondary"
          onPress={() =>
            navigation.navigate('TenantBaseline', { unitId: unit.unitId })
          }
        />
      )}
      <View style={styles.card}>
        <Text style={styles.title}>Your inspections</Text>
        <Text style={styles.body}>
          Capture each area, review your photos, and submit when ready. AI
          suggestions require landlord initiation and human review.
        </Text>
        <GuidedRecords
          showTitle={false}
          tenant
          onOpen={inspectionId =>
            navigation.navigate('GuidedInspection', { inspectionId })
          }
        />
        <ActionButton
          title="In-person appointments"
          variant="secondary"
          onPress={() => navigation.navigate('Appointments')}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>Maintenance</Text>
        <MaintenanceRecords
          showTitle={false}
          onOpen={requestId =>
            navigation.navigate('MaintenanceDetail', { requestId })
          }
          onResume={draftId =>
            navigation.navigate('ReportMaintenance', { draftId })
          }
        />
        <ActionButton
          title="Report maintenance"
          onPress={() => navigation.navigate('ReportMaintenance')}
        />
      </View>
      <ActionButton
        title="Unit history"
        variant="secondary"
        onPress={() => navigation.navigate('History')}
      />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  card: {
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  title: { fontSize: 20, fontWeight: typography.bold, color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.muted },
  error: { color: colors.error },
});
