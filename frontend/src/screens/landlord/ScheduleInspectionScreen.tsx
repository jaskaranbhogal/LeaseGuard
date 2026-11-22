import ScreenTitle from '../../components/ScreenTitle';
import { colors } from '../../theme/colors';
import { inspectionDateError } from '../../utils/landlordValidation';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LandlordStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
import {
  AssignmentOptions,
  createAssignment,
  createTemplate,
  getAssignmentOptions,
  Step,
} from '../../services/guidedInspectionService';
export default function ScheduleInspectionScreen({
  navigation,
  route,
}: NativeStackScreenProps<LandlordStackParamList, 'ScheduleInspection'>) {
  const [options, setOptions] = useState<AssignmentOptions>();
  const [unitId, setUnitId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [type, setType] = useState('move-in');
  const [due, setDue] = useState('');
  const [recurrence, setRecurrence] = useState(0);
  const [name, setName] = useState('Apartment inspection');
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const key = useRef(
    `guided_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  useEffect(() => {
    getAssignmentOptions()
      .then(o => {
        setOptions(o);
        const selected = o.units.find(u => u.id === route.params?.unitId);
        if (selected) {
          setUnitId(selected.id);
          setTenantId(selected.tenants[0]?.id || '');
          setTemplateId(selected.baseline_template_id || '');
        }
        setSteps(selected?.configured_steps || o.default_steps);
      })
      .catch(e => setError(e.message));
  }, [route.params?.unitId]);
  const unit = options?.units.find(u => u.id === unitId);
  async function saveTemplate() {
    setBusy(true);
    setError('');
    try {
      const t = await createTemplate(name, steps);
      setOptions(await getAssignmentOptions());
      setTemplateId(t.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    setBusy(true);
    setError('');
    try {
      const dateError = inspectionDateError(due);
      if (dateError) throw new Error(dateError);
      const saved = await createAssignment({
        unit_id: unitId,
        tenant_id: tenantId,
        template_id: templateId,
        inspection_type: type,
        due_at: new Date(`${due}T23:59:00`).toISOString(),
        recurrence_days: recurrence,
        idempotency_key: key.current,
      });
      navigation.navigate('AIInspectionReview', { inspectionId: saved.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <ScreenTitle
          title="Schedule inspection"
          onBack={() => {
            if (!busy) navigation.goBack();
          }}
        />
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        {review ? (
          <>
            <Text>
              {unit?.property} · {unit?.label}
            </Text>
            <Text>
              Tenant: {unit?.tenants.find(t => t.id === tenantId)?.label}
            </Text>
            <Text>
              {type} · Due {due} · Repeat{' '}
              {recurrence ? `every ${recurrence} days` : 'off'}
            </Text>
            <Text>
              Template:{' '}
              {options?.templates.find(t => t.id === templateId)?.name}
            </Text>
            <Button
              title="Confirm assignment"
              disabled={busy}
              onPress={assign}
            />
            <Button
              title="Edit assignment"
              disabled={busy}
              onPress={() => setReview(false)}
            />
          </>
        ) : (
          <>
            <Text>Choose a verified property and unit</Text>
            {!options?.units.length && (
              <Text>
                No managed units available. An administrator must verify
                property and tenant assignments.
              </Text>
            )}
            {options?.units.map(u => (
              <Button
                key={u.id}
                title={`${unitId === u.id ? '✓ ' : ''}${u.property} · ${
                  u.label
                }`}
                variant="outline"
                onPress={() => {
                  setUnitId(u.id);
                  setTenantId('');
                  setTemplateId(u.baseline_template_id || '');
                  setSteps(u.configured_steps || options.default_steps);
                }}
              />
            ))}
            <Text>Eligible tenant</Text>
            {unit?.tenants.map(t => (
              <Button
                key={t.id}
                title={`${tenantId === t.id ? '✓ ' : ''}${t.label}`}
                variant="outline"
                onPress={() => setTenantId(t.id)}
              />
            ))}
            {['move-in', 'periodic', 'move-out', 'follow-up'].map(t => (
              <Button
                key={t}
                title={`${type === t ? '✓ ' : ''}${t}`}
                variant="outline"
                onPress={() => setType(t)}
              />
            ))}
            <TextInput
              style={styles.input}
              accessibilityLabel="Due date"
              placeholder="Due date YYYY-MM-DD"
              value={due}
              onChangeText={setDue}
            />
            <Text>Recurrence (creates periodic assignments after review)</Text>
            {[0, 30, 90, 180, 365].map(n => (
              <Button
                key={n}
                title={`${recurrence === n ? '✓ ' : ''}${
                  n ? `Every ${n} days` : 'No recurrence'
                }`}
                variant="outline"
                onPress={() => setRecurrence(n)}
              />
            ))}
            <Text>Template</Text>
            {options?.templates.map(t => (
              <Button
                key={t.id}
                title={`${templateId === t.id ? '✓ ' : ''}${t.name} v${
                  t.version
                }`}
                variant="outline"
                onPress={() => setTemplateId(t.id)}
              />
            ))}
            <Text style={styles.title}>Create a layout template</Text>
            <Text>
              Use the same saved template for baseline and future inspections.
              Saved layouts remain unchanged; create a new layout for future
              areas.
            </Text>
            <TextInput
              accessibilityLabel="Template name"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <TextInput
                  style={styles.input}
                  accessibilityLabel={`Step ${i + 1} room`}
                  value={s.room}
                  onChangeText={room =>
                    setSteps(old =>
                      old.map((x, j) => (i === j ? { ...x, room } : x)),
                    )
                  }
                />
                <TextInput
                  style={styles.input}
                  accessibilityLabel={`Step ${i + 1} instructions`}
                  value={s.instructions}
                  onChangeText={instructions =>
                    setSteps(old =>
                      old.map((x, j) => (i === j ? { ...x, instructions } : x)),
                    )
                  }
                />
                <TextInput
                  style={styles.input}
                  accessibilityLabel={`Step ${i + 1} photo count`}
                  keyboardType="number-pad"
                  value={String(s.count)}
                  onChangeText={count =>
                    setSteps(old =>
                      old.map((x, j) =>
                        i === j ? { ...x, count: Number(count) } : x,
                      ),
                    )
                  }
                />
                <Button
                  title={`Remove step ${i + 1}`}
                  variant="outline"
                  onPress={() => setSteps(old => old.filter((_, j) => j !== i))}
                />
              </React.Fragment>
            ))}
            <Button
              title="Add room step"
              disabled={steps.length >= 20}
              onPress={() =>
                setSteps(old => [
                  ...old,
                  {
                    id: `area-${Date.now()}`,
                    room: 'Additional room',
                    instructions: 'Include walls, floor and fixtures.',
                    count: 1,
                  },
                ])
              }
            />
            <Button
              title="Save new template"
              disabled={busy}
              onPress={saveTemplate}
            />
            <Button
              title="Review assignment"
              disabled={busy || !unitId || !tenantId || !templateId || !due}
              onPress={() => setReview(true)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
  },
});
