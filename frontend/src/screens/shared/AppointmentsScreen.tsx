import { layout } from '../../theme/layout';
import StateCard from '../../components/StateCard';
import StatusBadge from '../../components/StatusBadge';
import { useCallback, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import { useAuth } from '../../context/AuthContext';
import {
  appointmentAction,
  listAppointments,
  offerAppointment,
  type Appointment,
} from '../../services/leaseService';
import {
  getAssignmentOptions,
  type AssignmentOptions,
} from '../../services/guidedInspectionService';
import { colors } from '../../theme/colors';
export default function AppointmentsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const landlord = user?.role === 'landlord';
  const offerKey = useRef(
    `appointment_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  const [records, setRecords] = useState<Appointment[]>([]);
  const [options, setOptions] = useState<AssignmentOptions>();
  const [unit, setUnit] = useState('');
  const [tenant, setTenant] = useState('');
  const [zone, setZone] = useState('America/New_York');
  const [dates, setDates] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const refresh = useCallback(async () => {
    try {
      setRecords((await listAppointments()).appointments);
      if (landlord) setOptions(await getAssignmentOptions());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [landlord]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
      offerKey.current = `appointment_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="In-person appointments"
        subtitle="Remote photo inspections remain available separately."
        onBack={() => navigation.goBack()}
      />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <ActionButton
        title="Refresh appointments"
        variant="secondary"
        disabled={busy}
        onPress={refresh}
      />
      {landlord && (
        <View style={styles.card}>
          <Text style={layout.body}>Offer appointment times</Text>
          <Text style={layout.body}>
            To reschedule, cancel the old appointment and offer new times.
            Previous offers and responses stay in history.
          </Text>
          {options?.units.map(u => (
            <ActionButton
              key={u.id}
              compact
              title={`${unit === u.id ? '✓ ' : ''}${u.property} · ${u.label}`}
              variant="secondary"
              onPress={() => {
                setUnit(u.id);
                setTenant('');
              }}
            />
          ))}
          {options?.units
            .find(u => u.id === unit)
            ?.tenants.map(t => (
              <ActionButton
                key={t.id}
                compact
                title={`${tenant === t.id ? '✓ ' : ''}${t.label}`}
                variant="secondary"
                onPress={() => setTenant(t.id)}
              />
            ))}
          <Field
            label="Time zone"
            value={zone}
            onChangeText={setZone}
            autoCapitalize="none"
          />
          <Field
            label="Offered dates and times"
            value={dates}
            onChangeText={setDates}
            multiline
            hint="One date and 24-hour time per line, e.g. 2026-12-01 14:00. Times use the selected time zone. Maximum 10."
          />
          <ActionButton
            title="Save offered times"
            disabled={busy || !unit || !tenant || !dates.trim()}
            onPress={() =>
              run(() =>
                offerAppointment({
                  idempotency_key: offerKey.current,
                  unit_id: unit,
                  tenant_id: tenant,
                  timezone: zone,
                  slots: dates
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean),
                }).then(() => setDates('')),
              )
            }
          />
        </View>
      )}
      {!records.length && !error && (
        <StateCard
          title="No appointments scheduled."
          message={
            landlord
              ? 'Choose a unit and offer times to arrange an in-person visit.'
              : 'Your landlord’s appointment offers will appear here. Remote photo inspections are available separately.'
          }
        />
      )}
      {records.map(a => (
        <View key={a.id} style={styles.card}>
          <StatusBadge status={a.status} />
          <Text style={layout.body}>Appointment · {a.status}</Text>
          <Text style={layout.body}>Time zone: {a.timezone}</Text>
          {a.slots.map(s => (
            <View key={s.id}>
              <Text style={layout.body}>
                {new Date(s.at).toLocaleString(undefined, {
                  timeZone: a.timezone,
                })}
                {a.confirmed_slot === s.id ? ' · Confirmed' : ''}
              </Text>
              {a.status !== 'cancelled' &&
                a.status !== 'confirmed' &&
                (!landlord ? (
                  <ActionButton
                    compact
                    variant="secondary"
                    title={`${
                      selected[a.id]?.includes(s.id) ? '✓ ' : ''
                    }Available at this time`}
                    disabled={busy}
                    onPress={() =>
                      setSelected(old => ({
                        ...old,
                        [a.id]: old[a.id]?.includes(s.id)
                          ? old[a.id].filter(v => v !== s.id)
                          : [...(old[a.id] || []), s.id],
                      }))
                    }
                  />
                ) : (
                  a.tenant_slots.includes(s.id) && (
                    <ActionButton
                      title="Confirm this time"
                      disabled={busy}
                      onPress={() =>
                        run(() =>
                          appointmentAction(a, {
                            action: 'confirm',
                            slot_id: s.id,
                          }),
                        )
                      }
                    />
                  )
                ))}
            </View>
          ))}
          {!landlord && ['offered', 'responded'].includes(a.status) && (
            <ActionButton
              title="Send availability"
              disabled={busy}
              onPress={() =>
                run(() =>
                  appointmentAction(a, {
                    action: 'respond',
                    slot_ids: selected[a.id] || [],
                  }),
                )
              }
            />
          )}
          {landlord && a.status !== 'cancelled' && (
            <ActionButton
              title="Cancel appointment"
              variant="dangerOutline"
              disabled={busy}
              onPress={() =>
                run(() => appointmentAction(a, { action: 'cancel' }))
              }
            />
          )}
          <Text style={layout.body}>
            {a.history
              .map(h => `${h.action} · ${new Date(h.at).toLocaleString()}`)
              .join('\n')}
          </Text>
        </View>
      ))}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
});
