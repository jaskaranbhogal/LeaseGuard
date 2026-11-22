import { Text, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LandlordStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionButton from '../../components/ActionButton';
import NotificationBell from '../../components/NotificationBell';
import Toast from '../../components/Toast';
import GuidedRecords from '../../components/GuidedRecords';
import { useAuth } from '../../context/AuthContext';
import {
  useLandlordDemo,
  useRefreshProperties,
} from '../../context/LandlordDemoContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
export default function LandlordDashboardScreen({
  navigation,
}: NativeStackScreenProps<LandlordStackParamList, 'Dashboard'>) {
  const { user } = useAuth();
  const { properties, error, toast, dismissToast, refresh } = useLandlordDemo();
  useRefreshProperties();
  return (
    <View style={styles.root}>
      <ScreenContainer style={styles.content}>
        <ScreenTitle
          title={`Welcome, ${user?.name?.trim() || user?.email || 'landlord'}`}
          subtitle={`${properties.length} ${
            properties.length === 1 ? 'property' : 'properties'
          }`}
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
        <ActionButton
          title="+ Add property"
          onPress={() => navigation.navigate('AddProperty')}
        />
        <ActionButton
          title="Refresh properties"
          variant="secondary"
          onPress={refresh}
        />
        {!properties.length && (
          <View style={styles.card}>
            <Text style={styles.title}>Add your first property</Text>
            <Text style={styles.body}>
              Add a property and its units, then invite your tenant by email to
              start tracking condition.
            </Text>
          </View>
        )}
        {properties.map(property => (
          <View key={property.id} style={styles.card}>
            <Text style={styles.title}>{property.street}</Text>
            <Text style={styles.body}>
              {property.city} · {property.units.length} units
            </Text>
            <ActionButton
              title="+ Add unit"
              compact
              variant="secondary"
              onPress={() =>
                navigation.navigate('AddProperty', { propertyId: property.id })
              }
            />
            {property.units.map(unit => (
              <View key={unit.id} style={styles.unit}>
                <Text style={styles.unitTitle}>Unit {unit.name}</Text>
                <Text style={styles.body}>
                  {unit.tenant?.status === 'joined'
                    ? `${unit.tenant.name || unit.tenant.email} · Joined`
                    : unit.tenant
                    ? `${unit.tenant.email} · ${
                        unit.tenant.status === 'declined'
                          ? 'Invitation declined'
                          : 'Pending invitation'
                      }`
                    : 'Vacant'}
                </Text>
                {unit.tenant?.status === 'pending' && (
                  <Text style={styles.body}>
                    Email:{' '}
                    {unit.tenant.delivery === 'email-accepted'
                      ? 'Accepted by email server'
                      : unit.tenant.delivery === 'failed'
                      ? 'Delivery failed; revoke and retry'
                      : 'Delivery unavailable; configure email, then revoke and retry'}
                  </Text>
                )}
                <Text style={styles.body}>
                  {unit.baselineRecordedOn
                    ? 'Approved baseline saved'
                    : 'Baseline needed'}
                </Text>
                <ActionButton
                  title={`Edit Unit ${unit.name}`}
                  variant="secondary"
                  compact
                  onPress={() =>
                    navigation.navigate('EditUnit', {
                      propertyId: property.id,
                      unitId: unit.id,
                    })
                  }
                />
                <ActionButton
                  title="Record move-in baseline"
                  compact
                  onPress={() =>
                    navigation.navigate('MoveInTour', {
                      propertyId: property.id,
                      unitId: unit.id,
                    })
                  }
                />
              </View>
            ))}
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.title}>Inspections</Text>
          <ActionButton
            title="Create Move-In Baseline"
            onPress={() => navigation.navigate('MoveInBaseline')}
          />
          <ActionButton
            title="Schedule inspection"
            onPress={() => navigation.navigate('ScheduleInspection')}
          />
          <ActionButton
            title="In-person appointments"
            variant="secondary"
            onPress={() => navigation.navigate('Appointments')}
          />
          <ActionButton
            title="Review inspections"
            variant="secondary"
            onPress={() => navigation.navigate('AIInspectionReview')}
          />
          <GuidedRecords
            onOpen={inspectionId =>
              navigation.navigate('AIInspectionReview', { inspectionId })
            }
          />
        </View>
        <ActionButton
          title="Maintenance requests"
          variant="secondary"
          onPress={() => navigation.navigate('MaintenanceRequests')}
        />
      </ScreenContainer>
      {toast && <Toast {...toast} onDismiss={dismissToast} />}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  unit: {
    borderTopWidth: 1,
    borderColor: colors.divider,
    paddingTop: 16,
    gap: 10,
  },
  unitTitle: {
    fontSize: 17,
    fontWeight: typography.semibold,
    color: colors.navy,
  },
  error: { color: colors.error },
});
