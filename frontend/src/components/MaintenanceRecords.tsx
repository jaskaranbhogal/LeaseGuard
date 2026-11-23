import { colors } from '../theme/colors';
import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as api from '../services/maintenanceService';
import Button from './Button';
import StateCard from './StateCard';
import StatusBadge from './StatusBadge';
import { layout } from '../theme/layout';
import { typography } from '../theme/typography';

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
  const stepIndex = STEPS.findIndex(st => st.status === record?.status);
  return (
    <View style={styles.list}>
      {!!error && (
        <Text style={layout.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh request"
        disabled={busy}
        onPress={load}
        hitSlop={8}
        style={styles.refresh}
      >
        <Text style={styles.link}>Refresh</Text>
      </Pressable>
      {busy && !record && <StateCard title="Loading request…" loading />}
      {record && (
        <>
          <View style={styles.card}>
            <View style={styles.headRow}>
              <Text style={styles.meta}>
                {`${record.area} • ${record.unit}`}
              </Text>
              <Text
                style={[
                  styles.pill,
                  record.urgency === 'urgent'
                    ? styles.pillUrgent
                    : styles.pillNormal,
                ]}
              >
                {`${record.urgency.toUpperCase()} URGENCY`}
              </Text>
            </View>
            <Text style={styles.description}>{record.description}</Text>
            <Text style={styles.meta}>
              {record.submitted_at
                ? `Reported: ${formatDate(record.submitted_at)}`
                : 'Unsubmitted draft'}
            </Text>
            <Text style={styles.meta}>{record.property}</Text>
            {record.status === 'draft' && onResume && (
              <Button title="Resume draft" onPress={onResume} />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>PHOTOS</Text>
            {!record.photos.length && (
              <Text style={layout.muted}>
                Accepted photos will appear here after secure storage is
                confirmed.
              </Text>
            )}
            <View style={styles.grid}>
              {record.photos.map((p, index) => (
                <View key={p.id} style={styles.cell}>
                  {p.available ? (
                    <PrivatePhoto
                      uri={api.maintenancePhotoUrl(id, p.id)}
                      index={index}
                    />
                  ) : (
                    <View style={[styles.photo, styles.photoGone]}>
                      <Text style={styles.photoGoneText}>
                        {p.state === 'ready' ? 'Retention expired' : p.state}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
            <Text style={styles.meta}>
              {`${record.photos.length} photo${
                record.photos.length === 1 ? '' : 's'
              }`}
            </Text>
          </View>

          {record.status !== 'draft' && (
            <View style={styles.card}>
              <View style={styles.headRow}>
                <Text style={styles.section}>STATUS</Text>
                <StatusBadge status={record.status} />
              </View>
              {STEPS.map((st, i) => {
                const done = i < stepIndex || record.status === 'resolved';
                const current = i === stepIndex && record.status !== 'resolved';
                return (
                  <View key={st.status} style={styles.stepRow}>
                    <View
                      style={[
                        styles.dot,
                        done && styles.dotDone,
                        current && styles.dotCurrent,
                      ]}
                    >
                      {done ? <Text style={styles.dotMark}>✓</Text> : null}
                    </View>
                    <Text
                      style={[
                        styles.stepText,
                        (done || current) && styles.stepTextOn,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.section}>WHAT'S HAPPENING</Text>
            {record.history.map((h, index) => (
              <View key={`${h.at}-${index}`} style={styles.activity}>
                <Text style={styles.activityDate}>{formatDate(h.at)}</Text>
                <Text style={styles.activityText}>
                  {STATUS_TEXT[h.status] || h.status.replace(/[-_]/g, ' ')}
                </Text>
              </View>
            ))}
            {!!record.comparison_limitation && (
              <Text style={styles.meta}>{record.comparison_limitation}</Text>
            )}
          </View>
          {landlord && next && (
            <Button title={`Mark ${next}`} disabled={busy} onPress={update} />
          )}
        </>
      )}
    </View>
  );
}

const STEPS = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'in-review', label: 'In review' },
  { status: 'in-progress', label: 'In progress' },
  { status: 'resolved', label: 'Resolved' },
];

const STATUS_TEXT: Record<string, string> = {
  draft: 'Draft started',
  submitted: 'Request submitted',
  'in-review': 'Landlord reviewing the issue',
  'in-progress': 'Repair in progress',
  resolved: 'Marked resolved',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  activity: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
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
    aspectRatio: 1,
    backgroundColor: colors.readOnly,
    borderRadius: 12,
  },
  refresh: { alignSelf: 'flex-end' },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: { fontSize: 13, color: colors.muted },
  description: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
  },
  pillNormal: { backgroundColor: colors.warnBg, color: colors.warnText },
  pillUrgent: { backgroundColor: colors.errorTint, color: colors.error },
  section: {
    fontSize: 12,
    fontWeight: typography.bold,
    letterSpacing: 0.5,
    color: colors.muted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '47%' },
  photoGone: { alignItems: 'center', justifyContent: 'center' },
  photoGoneText: { fontSize: 12, color: colors.muted },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { borderColor: colors.brand, backgroundColor: colors.brand },
  dotCurrent: { borderColor: colors.brand },
  dotMark: { fontSize: 12, fontWeight: typography.bold, color: colors.white },
  stepText: { fontSize: 15, color: colors.muted },
  stepTextOn: { color: colors.ink, fontWeight: typography.medium },
  activityDate: { width: 96, fontSize: 13, color: colors.muted },
  activityText: { flex: 1, fontSize: 14, color: colors.ink },
});
