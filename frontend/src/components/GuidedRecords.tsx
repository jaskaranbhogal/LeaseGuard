import { colors } from '../theme/colors';
import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Button from './Button';
import StateCard from './StateCard';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import { layout } from '../theme/layout';
import {
  listGuided,
  GuidedInspection,
} from '../services/guidedInspectionService';
export default function GuidedRecords({
  onOpen,
  tenant = false,
  showTitle = true,
}: {
  onOpen: (id: string) => void;
  tenant?: boolean;
  showTitle?: boolean;
}) {
  const [records, setRecords] = useState<GuidedInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const data = await listGuided(cursor);
      setRecords(old =>
        cursor ? [...old, ...data.inspections] : data.inspections,
      );
      setNext(data.next);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return (
    <View style={styles.list}>
      {showTitle && <Text style={styles.title}>Photo inspections</Text>}
      {!!error && (
        <Text style={layout.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button
        title="Refresh inspections"
        variant="outline"
        disabled={loading}
        onPress={() => load()}
      />
      {loading && !records.length && (
        <StateCard title="Loading inspections…" loading />
      )}
      {!loading && !records.length && !error && (
        <View style={styles.card}>
          <Text style={styles.title}>No assigned inspections yet</Text>
          <Text style={styles.description}>
            {tenant
              ? 'Your landlord needs to assign a photo inspection to your account and unit before you can start.'
              : 'Assign a photo inspection to a verified unit and tenant to get started.'}
          </Text>
          {tenant && (
            <Text style={styles.description}>
              Once assigned, a Start guided inspection button will appear here.
              Maintenance reports are separate from inspections.
            </Text>
          )}
        </View>
      )}
      {records.map(r => (
        <View key={r.id} style={styles.card}>
          <View style={styles.statusRow}>
            <StatusBadge status={r.status} />
            {r.overdue && <StatusBadge status="overdue" />}
          </View>
          <Text style={styles.title}>
            {r.property} · {r.unit}
          </Text>
          <Text style={layout.muted}>
            {r.inspection_type} · {r.status}
            {r.overdue ? ' · Overdue' : r.upcoming ? ' · Upcoming' : ''}
          </Text>
          <Text style={layout.muted}>
            Due {new Date(r.due_at).toLocaleDateString()} · {r.progress}/
            {r.required} photos saved
          </Text>
          <ProgressBar value={r.required ? r.progress / r.required : 0} />
          <Button
            title={
              tenant
                ? r.status === 'assigned'
                  ? 'Start guided inspection'
                  : ['draft', 'retake'].includes(r.status)
                  ? 'Resume guided inspection'
                  : 'View submitted inspection'
                : `Open ${r.inspection_type} inspection`
            }
            onPress={() => onOpen(r.id)}
          />
        </View>
      ))}
      {next && (
        <Button title="Load older inspections" onPress={() => load(next)} />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { ...layout.sectionTitle },
  description: { ...layout.muted },
});
