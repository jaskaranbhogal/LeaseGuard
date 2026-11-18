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
}: {
  onOpen: (id: string) => void;
}) {
  const [records, setRecords] = useState<GuidedInspection[]>([]);
  const [error, setError] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const load = useCallback(async (cursor?: string) => {
    try {
      const data = await listGuided(cursor);
      setRecords(old =>
        cursor ? [...old, ...data.inspections] : data.inspections,
      );
      setNext(data.next);
      setError('');
    } catch (e) {
      setError((e as Error).message);
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
        onPress={() => load()}
      />
      {!records.length && !error && <Text>No assigned inspections.</Text>}
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
            title={`Open ${r.inspection_type} inspection`}
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
});
