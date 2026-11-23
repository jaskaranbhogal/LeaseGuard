import { colors } from '../theme/colors';
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/maintenanceService';
import Button from './Button';
import StateCard from './StateCard';
import StatusBadge from './StatusBadge';
import { layout } from '../theme/layout';

export function MaintenanceRecords({
  onOpen,
  onResume,
  showTitle = true,
}: {
  onOpen: (id: string) => void;
  onResume?: (id: string) => void;
  showTitle?: boolean;
}) {
  const [records, setRecords] = useState<api.MaintenanceRequest[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (before?: string) => {
    setBusy(true);
    setError('');
    try {
      const page = await api.listMaintenance(before);
      setRecords(old => (before ? [...old, ...page.requests] : page.requests));
      setNext(page.next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  return (
    <View style={styles.list}>
      {showTitle && (
        <Text style={styles.title}>Saved maintenance requests</Text>
      )}
      {!!error && (
        <Text style={layout.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button
        title="Refresh requests"
        variant="outline"
        disabled={busy}
        onPress={() => load()}
      />
      {busy && !records.length && (
        <StateCard title="Loading maintenance…" loading />
      )}
      {!busy && !error && !records.length && (
        <StateCard
          title="No saved maintenance requests."
          message="Saved drafts and submitted repair requests will appear here."
        />
      )}
      {records.map(r => (
        <Pressable
          key={r.id}
          style={styles.card}
          onPress={() =>
            r.status === 'draft' && onResume ? onResume(r.id) : onOpen(r.id)
          }
          accessibilityRole="button"
          accessibilityLabel={r.area}
        >
          <StatusBadge status={r.status} />
          <Text style={styles.title}>{r.area}</Text>
          <Text style={layout.muted}>
            {r.property} · {r.unit}
          </Text>
          <Text style={layout.body}>{r.description}</Text>
          <Text style={layout.muted}>
            {r.photos.filter(p => p.state === 'ready').length} photos ·{' '}
            {r.urgency} priority
          </Text>
          <Text style={layout.muted}>
            {r.submitted_at
              ? `Submitted ${new Date(r.submitted_at).toLocaleDateString()}`
              : 'Draft — tap to resume'}
          </Text>
          <Text style={styles.link}>
            {r.status === 'draft' && onResume
              ? 'Resume saved draft →'
              : 'View request →'}
          </Text>
        </Pressable>
      ))}
      {next && (
        <Button
          title="Load older requests"
          variant="outline"
          disabled={busy}
          onPress={() => load(next)}
        />
      )}
    </View>
  );
}

export function MaintenanceRecord({
  id,
  landlord = false,
  onResume,
}: {
  id: string;
  landlord?: boolean;
  onResume?: () => void;
}) {
  const [record, setRecord] = useState<api.MaintenanceRequest>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setRecord(await api.getMaintenance(id));
    } catch (e) {
      setRecord(undefined);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  const next = {
    submitted: 'in-review',
    'in-review': 'in-progress',
    'in-progress': 'resolved',
  }[record?.status as string];
  async function update() {
    if (busy || !next) return;
    setBusy(true);
    setError('');
    try {
      setRecord(await api.updateMaintenanceStatus(id, next));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.list}>
      {!!error && (
        <Text style={layout.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button
        title="Refresh request"
        variant="outline"
        disabled={busy}
        onPress={load}
      />
      {busy && !record && <StateCard title="Loading request…" loading />}
      {record && (
        <>
          <View style={styles.card}>
            <StatusBadge status={record.status} />
            <Text style={styles.title}>{record.area}</Text>
            <Text style={layout.muted}>
              {record.property} · {record.unit}
            </Text>
            <Text style={layout.body}>{record.description}</Text>
            <StatusBadge status={record.urgency} />
            <Text style={layout.muted}>
              {record.submitted_at
                ? `Submitted ${new Date(record.submitted_at).toLocaleString()}`
                : 'Unsubmitted draft'}
            </Text>
            {record.status === 'draft' && onResume && (
              <Button title="Resume draft" onPress={onResume} />
            )}
          </View>
          <Text style={styles.title}>
            Photo evidence · {record.photos.length} photos
          </Text>
          {!record.photos.length && (
            <StateCard
              title="No photos saved"
              message="Accepted photos will appear here after secure storage is confirmed."
            />
          )}
          {record.photos.map((p, index) => (
            <View key={p.id} style={styles.card}>
              <Text style={layout.label}>Photo {index + 1}</Text>
              {p.available ? (
                <PrivatePhoto
                  uri={api.maintenancePhotoUrl(id, p.id)}
                  index={index}
                />
              ) : (
                <Text style={layout.muted}>
                  Photo {index + 1}:{' '}
                  {p.state === 'ready' ? 'retention period expired' : p.state}
                </Text>
              )}
            </View>
          ))}
          <View style={styles.card}>
            <Text style={styles.title}>Request activity</Text>
            {record.history.map((h, index) => (
              <View key={`${h.at}-${index}`} style={styles.activity}>
                <StatusBadge status={h.status} />
                <Text style={layout.muted}>
                  {new Date(h.at).toLocaleString()}
                </Text>
              </View>
            ))}
            <Text style={layout.muted}>{record.comparison_limitation}</Text>
          </View>
          {landlord && next && (
            <Button title={`Mark ${next}`} disabled={busy} onPress={update} />
          )}
        </>
      )}
    </View>
  );
}

function PrivatePhoto({ uri, index }: { uri: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <View>
      <Image
        key={attempt}
        source={{ uri }}
        resizeMode="contain"
        style={styles.photo}
        accessibilityLabel={`Maintenance photo ${index + 1}`}
        onError={() => setFailed(true)}
      />
      {failed && (
        <Pressable
          style={styles.photoRetry}
          accessibilityRole="button"
          onPress={() => {
            setFailed(false);
            setAttempt(v => v + 1);
          }}
        >
          <Text style={styles.link}>Photo unavailable — retry</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  photoRetry: { minHeight: 44, justifyContent: 'center' },
  list: { gap: 16 },
  activity: { gap: 8, paddingVertical: 8 },
  title: { ...layout.sectionTitle },
  card: {
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  link: {
    color: colors.brand,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: colors.cardBorder,
    borderRadius: 12,
  },
});
