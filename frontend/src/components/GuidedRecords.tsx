import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Button from './Button';
import {
  listGuided,
  GuidedInspection,
} from '../services/guidedInspectionService';
export default function GuidedRecords({
  onOpen,
  tenant = false,
}: {
  onOpen: (id: string) => void;
  tenant?: boolean;
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
      <Text style={styles.title}>Photo inspections</Text>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Button
        title="Refresh inspections"
        variant="outline"
        disabled={loading}
        onPress={() => load()}
      />
      {loading && <Text>Loading inspections…</Text>}
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
          <Text style={styles.title}>
            {r.property} · {r.unit}
          </Text>
          <Text>
            {r.inspection_type} · {r.status}
            {r.overdue ? ' · Overdue' : r.upcoming ? ' · Upcoming' : ''}
          </Text>
          <Text>
            Due {new Date(r.due_at).toLocaleDateString()} · {r.progress}/
            {r.required} photos saved
          </Text>
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
  card: { padding: 16, gap: 10, backgroundColor: 'white', borderRadius: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#131824' },
  description: { fontSize: 16, lineHeight: 24, color: '#5E6B80' },
});
