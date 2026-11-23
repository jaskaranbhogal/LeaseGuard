import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/maintenanceService';

export function MaintenanceRecords({
  onOpen,
  onResume,
}: {
  onOpen: (id: string) => void;
  onResume?: (id: string) => void;
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
      <Text style={styles.title}>Saved maintenance requests</Text>
      {busy && <ActivityIndicator accessibilityLabel="Loading maintenance" />}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Pressable
        disabled={busy}
        onPress={() => {
          load();
        }}
      >
        <Text style={styles.link}>Refresh requests</Text>
      </Pressable>
      {!busy && !error && !records.length && (
        <Text>No saved maintenance requests.</Text>
      )}
      {records.map(r => (
        <Pressable
          key={r.id}
          style={styles.card}
          onPress={() =>
            r.status === 'draft' && onResume ? onResume(r.id) : onOpen(r.id)
          }
          accessibilityRole="button"
        >
          <Text style={styles.title}>{r.area}</Text>
          <Text>
            {r.property} · {r.unit}
          </Text>
          <Text>{r.description}</Text>
          <Text>
            {r.status} · {r.photos.filter(p => p.state === 'ready').length}{' '}
            photos
          </Text>
          <Text>
            {r.submitted_at
              ? `Submitted ${new Date(r.submitted_at).toLocaleDateString()}`
              : 'Draft — tap to resume'}
          </Text>
        </Pressable>
      ))}
      {next && (
        <Pressable
          disabled={busy}
          onPress={() => {
            load(next);
          }}
        >
          <Text style={styles.link}>Load older requests</Text>
        </Pressable>
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
      {busy && <ActivityIndicator accessibilityLabel="Loading request" />}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Pressable
        disabled={busy}
        onPress={() => {
          load();
        }}
      >
        <Text style={styles.link}>Refresh request</Text>
      </Pressable>
      {record && (
        <>
          <Text style={styles.title}>{record.area}</Text>
          <Text>
            {record.property} · {record.unit}
          </Text>
          <Text>{record.description}</Text>
          <Text>Urgency: {record.urgency}</Text>
          <Text>Status: {record.status}</Text>
          <Text>
            {record.submitted_at
              ? `Submitted ${new Date(record.submitted_at).toLocaleString()}`
              : 'Unsubmitted draft'}
          </Text>
          <Text>{record.photos.length} photos</Text>
          {record.status === 'draft' && onResume && (
            <Pressable onPress={onResume}>
              <Text style={styles.link}>Resume draft</Text>
            </Pressable>
          )}
          {record.photos.map((p, index) => (
            <View key={p.id}>
              {p.available ? (
                <PrivatePhoto
                  uri={api.maintenancePhotoUrl(id, p.id)}
                  index={index}
                />
              ) : (
                <Text>
                  Photo {index + 1}:{' '}
                  {p.state === 'ready' ? 'retention period expired' : p.state}
                </Text>
              )}
            </View>
          ))}
          {record.history.map(h => (
            <Text key={`${h.at}-${h.status}`}>
              {h.status} · {new Date(h.at).toLocaleString()}
            </Text>
          ))}
          <Text>{record.comparison_limitation}</Text>
          {landlord && next && (
            <Pressable
              disabled={busy}
              onPress={() => {
                update();
              }}
              style={styles.card}
            >
              <Text style={styles.link}>Mark {next}</Text>
            </Pressable>
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
  list: { gap: 16, marginTop: 20 },
  title: { fontSize: 18, fontWeight: '600', color: '#131824' },
  card: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D6DEEB',
    gap: 8,
  },
  link: { color: '#1459EB', paddingVertical: 12 },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#D6DEEB',
    borderRadius: 12,
  },
});
