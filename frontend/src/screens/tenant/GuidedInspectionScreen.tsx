import EvidenceImage from '../../components/EvidenceImage';
import { layout } from '../../theme/layout';
import StatusBadge from '../../components/StatusBadge';
import StateCard from '../../components/StateCard';
import CameraFrame from '../../components/CameraFrame';
import ScreenTitle from '../../components/ScreenTitle';
import PhotoTile from '../../components/PhotoTile';
import ActionButton from '../../components/ActionButton';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import EvidenceNotes from '../../components/EvidenceNotes';
import ProgressBar from '../../components/ProgressBar';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import type { TenantStackParamList } from '../../navigation/types';
import PhotoReview from '../../components/PhotoReview';
import GuidedRecords from '../../components/GuidedRecords';
import {
  createGuidedMaintenance,
  getGuided,
  guidedAction,
  guidedPhotoUrl,
  uploadGuided,
  GuidedInspection,
} from '../../services/guidedInspectionService';

const TYPE_TITLES: Record<string, string> = {
  'move-in': 'Move-in inspection',
  periodic: 'Routine inspection',
  'move-out': 'Move-out inspection',
  'follow-up': 'Follow-up inspection',
};

function shortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function GuidedInspectionScreen({
  route,
  navigation,
}: NativeStackScreenProps<TenantStackParamList, 'GuidedInspection'>) {
  const id = route.params?.inspectionId;
  const [record, setRecord] = useState<GuidedInspection>();
  const [index, setIndex] = useState(0);
  const [asset, setAsset] = useState<Asset>();
  const [retryAsset, setRetryAsset] = useState<Asset>();
  const [busy, setBusy] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (id) {
      try {
        setRecord(await getGuided(id));
        setError('');
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const slots =
    record?.steps.flatMap(s =>
      Array.from({ length: s.count }, (_, slot) => ({ ...s, slot })),
    ) || [];
  const step = slots[index];
  const photo = record?.photos.find(
    p => p.step_id === step?.id && p.slot === step?.slot,
  );
  const baseline = record?.baseline_photos.find(
    p => p.step_id === step?.id && p.slot === step?.slot,
  );
  const editable =
    record && ['assigned', 'draft', 'retake'].includes(record.status);
  const complete = !!record && record.progress === record.required;
  const typeTitle = record
    ? TYPE_TITLES[record.inspection_type] || 'Photo inspection'
    : 'Photo inspection';
  const stepLabel = step
    ? `${step.room}${step.count > 1 ? ` · Photo ${step.slot + 1}` : ''}`
    : '';

  async function pick(camera: boolean) {
    try {
      const result = await (camera ? launchCamera : launchImageLibrary)({
        mediaType: 'photo',
        selectionLimit: 1,
        assetRepresentationMode: 'compatible',
        quality: 0.8,
      });
      if (result.errorCode)
        throw new Error(
          result.errorMessage ||
            'Camera or gallery unavailable. Check permissions.',
        );
      if (result.assets?.[0]) setAsset(result.assets[0]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function accept(selected: Asset | undefined, note = '') {
    if (!record || !step || !selected || busy) return;
    setBusy(true);
    setAsset(undefined);
    setRetryAsset(selected);
    setProgress(0);
    setError('');
    try {
      let saved = await uploadGuided(
        record,
        step.id,
        step.slot,
        selected,
        setProgress,
      );
      const uploaded = saved.photos.find(
        p => p.step_id === step.id && p.slot === step.slot,
      );
      if (note.trim() && uploaded) {
        saved = await guidedAction(saved, 'notes', {
          photo_id: uploaded.id,
          note: note.trim(),
          kind: 'observation',
        });
      }
      setRecord(saved);
      setRetryAsset(undefined);
      setRetaking(false);
      setIndex(i => Math.min(i + 1, slots.length - 1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!record) return;
    setBusy(true);
    setError('');
    try {
      const saved = await guidedAction(record, 'submit');
      setRecord(saved);
      navigation.navigate('InspectionSubmitted', { inspectionId: saved.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function goTo(next: number) {
    setIndex(next);
    setRetryAsset(undefined);
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layout.content}
      >
        <ScreenTitle
          title={id ? typeTitle : 'Photo inspections'}
          subtitle={
            step && (!complete || retaking)
              ? `Step ${index + 1} of ${slots.length} • ${stepLabel}`
              : record
              ? `${record.property} • ${record.unit}`
              : undefined
          }
          onBack={() => {
            if (!busy) navigation.goBack();
          }}
        />
        {!id ? (
          <GuidedRecords
            tenant
            onOpen={inspectionId => navigation.setParams({ inspectionId })}
          />
        ) : (
          <>
            {!!error && (
              <Text style={layout.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
            {!record && !error && (
              <StateCard title="Loading inspection…" loading />
            )}
            {record && (
              <>
                <ProgressBar value={record.progress / record.required} />
                <View style={styles.summary}>
                  <StatusBadge status={record.status} />
                  <Text style={styles.summaryText}>
                    {`Due ${shortDate(record.due_at)} • ${record.progress} of ${
                      record.required
                    } photos securely saved`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Refresh saved progress"
                    disabled={busy}
                    onPress={refresh}
                    hitSlop={8}
                  >
                    <Text style={styles.stepLink}>Refresh</Text>
                  </Pressable>
                </View>

                {record.history
                  .filter(h => h.reason)
                  .map((h, i) => (
                    <View key={i} style={styles.warn}>
                      <Text style={styles.warnTitle}>Retake requested</Text>
                      <Text style={styles.warnBody}>{h.reason}</Text>
                    </View>
                  ))}

                {step && editable && (!complete || retaking) && (
                  <>
                    <View style={layout.notice}>
                      <Text style={styles.tipTitle}>
                        {baseline
                          ? 'Line up with your baseline photo'
                          : `Photograph the ${stepLabel.toLowerCase()}`}
                      </Text>
                      <Text style={styles.tipBody}>
                        {step.instructions ||
                          (baseline
                            ? `The faint image is the move-in baseline. Stand in the same spot and match it as closely as you can.`
                            : 'Stand back, hold your phone level, and turn on the lights.')}
                      </Text>
                      <Text style={styles.tipBody}>
                        <Text style={styles.bold}>Small scratch or mark?</Text>{' '}
                        Take a close-up too.
                      </Text>
                    </View>
                    {photo ? (
                      <EvidenceImage
                        accessibilityLabel="Saved inspection photo"
                        source={{ uri: guidedPhotoUrl(record.id, photo.id) }}
                        style={styles.photo}
                      />
                    ) : (
                      <CameraFrame
                        overlayUri={
                          baseline
                            ? guidedPhotoUrl(record.id, baseline.id, true)
                            : undefined
                        }
                        overlayLabel={baseline ? 'Baseline overlay' : undefined}
                        badge={baseline ? 'Overlay on' : undefined}
                      />
                    )}
                    {baseline && (
                      <EvidenceNotes notes={baseline.notes} baseline />
                    )}
                    {photo && (
                      <EvidenceNotes
                        notes={photo.notes}
                        busy={busy}
                        onSave={async (note, kind) => {
                          setBusy(true);
                          try {
                            setRecord(
                              await guidedAction(record, 'notes', {
                                photo_id: photo.id,
                                note,
                                kind,
                              }),
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    )}
                    {busy && (
                      <Text style={layout.muted}>
                        {progress < 100
                          ? `Uploading ${progress}%`
                          : 'Waiting for secure storage confirmation…'}
                      </Text>
                    )}
                    <ActionButton
                      title={photo ? 'Retake photo' : 'Capture photo'}
                      disabled={busy}
                      onPress={() => pick(true)}
                    />
                    <ActionButton
                      title="Choose from gallery"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => pick(false)}
                    />
                    {retryAsset && (
                      <ActionButton
                        title="Retry same photo"
                        disabled={busy}
                        onPress={() => accept(retryAsset)}
                      />
                    )}
                    <View style={styles.stepRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: busy || index === 0 }}
                        disabled={busy || index === 0}
                        onPress={() => goTo(index - 1)}
                        hitSlop={8}
                      >
                        <Text
                          style={[
                            styles.stepLink,
                            (busy || index === 0) && styles.stepLinkOff,
                          ]}
                        >
                          Previous
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: busy || index === slots.length - 1,
                        }}
                        disabled={busy || index === slots.length - 1}
                        onPress={() => goTo(index + 1)}
                        hitSlop={8}
                      >
                        <Text
                          style={[
                            styles.stepLink,
                            (busy || index === slots.length - 1) &&
                              styles.stepLinkOff,
                          ]}
                        >
                          Next
                        </Text>
                      </Pressable>
                    </View>
                    <ActionButton
                      title={
                        retaking ? 'Back to review' : 'Save & finish later'
                      }
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        retaking ? setRetaking(false) : navigation.goBack()
                      }
                    />
                  </>
                )}

                {!!record.uploads.length && (
                  <Text style={layout.muted}>
                    Some uploads need recovery. Re-select the same photo and
                    retry after the upload lease expires.
                  </Text>
                )}

                {complete && !retaking && (
                  <>
                    <Text style={styles.sectionTitle}>Review your photos</Text>
                    <Text style={styles.sectionSub}>
                      {`${
                        TYPE_TITLES[record.inspection_type] || 'Inspection'
                      } • ${record.progress} of ${record.required} areas done`}
                    </Text>
                    <View style={styles.grid}>
                      {record.photos.map(p => (
                        <View key={p.id} style={styles.cell}>
                          <PhotoTile
                            area={
                              record.steps.find(s => s.id === p.step_id)
                                ?.room || p.step_id
                            }
                            uri={guidedPhotoUrl(record.id, p.id)}
                            placeholder="Saved photo"
                            onRetake={
                              editable
                                ? () => {
                                    setIndex(
                                      slots.findIndex(
                                        s =>
                                          s.id === p.step_id &&
                                          s.slot === p.slot,
                                      ),
                                    );
                                    setRetaking(true);
                                  }
                                : undefined
                            }
                          />
                          <EvidenceNotes notes={p.notes} />
                        </View>
                      ))}
                    </View>
                    {editable && (
                      <Text style={layout.muted}>
                        Tap Retake to replace a photo. Once you submit, photos
                        can't be changed.
                      </Text>
                    )}
                  </>
                )}

                {editable && !retaking && (
                  <ActionButton
                    title="Submit inspection"
                    disabled={busy || !complete}
                    onPress={submit}
                  />
                )}

                {!!record.comparisons.length && (
                  <View style={layout.card}>
                    <Text style={styles.cardTitle}>Landlord review</Text>
                    {record.comparisons.map(c => (
                      <Text key={c.id} style={layout.muted}>
                        {`${c.result?.summary || 'Comparison pending'} • ${
                          c.decision
                            ? `Landlord ${c.decision}`
                            : 'Awaiting landlord decision'
                        }`}
                      </Text>
                    ))}
                    {record.comparisons
                      .filter(c => c.decision === 'confirmed')
                      .map(c => (
                        <ActionButton
                          key={c.id}
                          title="Create maintenance follow-up"
                          compact
                          disabled={busy}
                          onPress={async () => {
                            setBusy(true);
                            try {
                              const draft = await createGuidedMaintenance(
                                record.id,
                                c.id,
                              );
                              navigation.navigate('ReportMaintenance', {
                                draftId: draft.maintenance_id,
                              });
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        />
                      ))}
                  </View>
                )}

                {record.status === 'retake' && (
                  <ActionButton
                    title="Report maintenance follow-up"
                    variant="secondary"
                    onPress={() => navigation.navigate('ReportMaintenance')}
                  />
                )}

                {!!record.history.length && (
                  <View style={layout.card}>
                    <Text style={styles.cardTitle}>Activity</Text>
                    {record.history.map((h, i) => (
                      <Text key={i} style={layout.muted}>
                        {`${new Date(h.at).toLocaleString()} • ${h.action}`}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      <PhotoReview
        asset={asset}
        step={
          step
            ? `Step ${index + 1} of ${slots.length} • ${stepLabel}`
            : undefined
        }
        baselineUri={
          record && baseline
            ? guidedPhotoUrl(record.id, baseline.id, true)
            : undefined
        }
        remaining={Math.max(
          0,
          (record?.required || 0) - (record?.progress || 0),
        )}
        onDiscard={() => setAsset(undefined)}
        withNote
        onAccept={note => accept(asset, note)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { flex: 1, fontSize: 13, color: colors.muted },
  warn: {
    padding: 14,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F4D58A',
    backgroundColor: colors.warnBg,
  },
  warnTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.warnText,
  },
  warnBody: { fontSize: 13, lineHeight: 19, color: colors.warnText },
  tipTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  tipBody: { fontSize: 13, lineHeight: 19, color: colors.brandSoftText },
  bold: { fontWeight: typography.semibold, color: colors.ink },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    resizeMode: 'contain',
    borderRadius: 20,
    backgroundColor: colors.readOnly,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepLink: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  stepLinkOff: { color: colors.disabledText },
  sectionTitle: {
    fontSize: 22,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  sectionSub: { marginTop: -8, fontSize: 13, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { width: '47%', gap: 6 },
  cardTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
});
