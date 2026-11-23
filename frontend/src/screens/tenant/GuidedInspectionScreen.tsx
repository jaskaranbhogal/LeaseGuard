import EvidenceImage from '../../components/EvidenceImage';
import { layout } from '../../theme/layout';
import StatusBadge from '../../components/StatusBadge';
import StateCard from '../../components/StateCard';
import CameraFrame from '../../components/CameraFrame';
import ScreenTitle from '../../components/ScreenTitle';
import PhotoTile from '../../components/PhotoTile';
import { colors } from '../../theme/colors';
import EvidenceNotes from '../../components/EvidenceNotes';
import ProgressBar from '../../components/ProgressBar';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import type { TenantStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
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
  const editable =
    record && ['assigned', 'draft', 'retake'].includes(record.status);
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
  async function accept(selected: Asset | undefined) {
    if (!record || !step || !selected || busy) return;
    setBusy(true);
    setAsset(undefined);
    setRetryAsset(selected);
    setProgress(0);
    setError('');
    try {
      const saved = await uploadGuided(
        record,
        step.id,
        step.slot,
        selected,
        setProgress,
      );
      setRecord(saved);
      setRetryAsset(undefined);
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
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layout.content}
      >
        <ScreenTitle
          title="Guided photo inspection"
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
            <Button
              title="Refresh saved progress"
              disabled={busy}
              variant="outline"
              onPress={refresh}
            />
            {!record && !error && (
              <StateCard title="Loading inspection…" loading />
            )}
            {record && (
              <>
                <View style={layout.card}>
                  <StatusBadge status={record.status} />
                  <Text style={layout.sectionTitle}>
                    {record.property} · {record.unit} · {record.inspection_type}
                  </Text>
                  <Text style={layout.body}>
                    Due {new Date(record.due_at).toLocaleDateString()} ·{' '}
                    {record.status}
                  </Text>
                  <ProgressBar value={record.progress / record.required} />
                  <Text style={layout.body}>
                    {record.progress}/{record.required} photos securely saved
                  </Text>
                </View>
                {record.history
                  .filter(h => h.reason)
                  .map((h, i) => (
                    <Text key={i}>Retake request: {h.reason}</Text>
                  ))}
                {step && (
                  <View style={layout.card}>
                    <View style={layout.notice}>
                      <Text style={layout.label}>
                        PHOTO GUIDE · STEP {index + 1} OF {slots.length}
                      </Text>
                      <Text style={styles.title}>
                        {index + 1}. {step.room} · Photo {step.slot + 1}
                      </Text>
                      <Text style={layout.body}>{step.instructions}</Text>
                    </View>
                    {record.baseline_photos
                      .filter(
                        p => p.step_id === step.id && p.slot === step.slot,
                      )
                      .map(p => (
                        <View key={p.id}>
                          <Text style={layout.body}>
                            Approved baseline reference · static preview
                          </Text>
                          <CameraFrame
                            overlayUri={guidedPhotoUrl(record.id, p.id, true)}
                            overlayLabel="Static reference · match this angle in your next photo"
                          />
                          <EvidenceNotes notes={p.notes} />
                        </View>
                      ))}
                    {photo && (
                      <EvidenceImage
                        accessibilityLabel="Saved inspection photo"
                        source={{ uri: guidedPhotoUrl(record.id, photo.id) }}
                        style={styles.photo}
                      />
                    )}
                    {photo && (
                      <EvidenceNotes
                        notes={photo.notes}
                        busy={busy}
                        onSave={
                          editable
                            ? async (note, kind) => {
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
                              }
                            : undefined
                        }
                      />
                    )}
                    {busy && (
                      <Text style={layout.body}>
                        {progress < 100
                          ? `Transferring ${progress}%`
                          : 'Waiting for secure storage confirmation…'}
                      </Text>
                    )}
                    {editable && (
                      <>
                        <Button
                          title={
                            photo ? 'Replace with camera photo' : 'Take photo'
                          }
                          disabled={busy}
                          onPress={() => pick(true)}
                        />
                        <Button
                          title="Choose from gallery"
                          variant="outline"
                          disabled={busy}
                          onPress={() => pick(false)}
                        />
                        {retryAsset && (
                          <Button
                            title="Retry same photo"
                            disabled={busy}
                            onPress={() => accept(retryAsset)}
                          />
                        )}
                      </>
                    )}
                    <View style={styles.row}>
                      <Button
                        title="Previous"
                        variant="outline"
                        style={styles.stepButton}
                        disabled={busy || index === 0}
                        onPress={() => {
                          setIndex(index - 1);
                          setRetryAsset(undefined);
                        }}
                      />
                      <Button
                        title="Next"
                        variant="outline"
                        style={styles.stepButton}
                        disabled={busy || index === slots.length - 1}
                        onPress={() => {
                          setIndex(index + 1);
                          setRetryAsset(undefined);
                        }}
                      />
                    </View>
                  </View>
                )}
                {!!record.uploads.length && (
                  <Text style={layout.body}>
                    Some uploads need recovery. Re-select the same photo and
                    retry after the upload lease expires.
                  </Text>
                )}
                {record.progress === record.required && (
                  <View style={styles.reviewList}>
                    <Text style={styles.title}>
                      Review all inspection photos
                    </Text>
                    {record.photos.map(p => (
                      <View key={p.id}>
                        <PhotoTile
                          area={
                            record.steps.find(s => s.id === p.step_id)?.room ||
                            p.step_id
                          }
                          uri={guidedPhotoUrl(record.id, p.id)}
                          placeholder="Saved evidence"
                          onRetake={
                            editable
                              ? () =>
                                  setIndex(
                                    slots.findIndex(
                                      s =>
                                        s.id === p.step_id && s.slot === p.slot,
                                    ),
                                  )
                              : undefined
                          }
                        />
                        <EvidenceNotes notes={p.notes} />
                      </View>
                    ))}
                  </View>
                )}
                {editable && (
                  <Button
                    title="Submit inspection"
                    disabled={busy || record.progress !== record.required}
                    onPress={submit}
                  />
                )}
                {record.comparisons
                  .filter(c => c.decision === 'confirmed')
                  .map(c => (
                    <Button
                      key={c.id}
                      title="Create maintenance follow-up"
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
                {record.comparisons.map(c => (
                  <Text key={c.id}>
                    Advisory finding: {c.result?.summary || 'Pending'} ·
                    Landlord decision: {c.decision || 'Pending'}
                  </Text>
                ))}
                {record.history.map((h, i) => (
                  <Text key={i}>
                    {new Date(h.at).toLocaleString()} · {h.action}
                  </Text>
                ))}
                {record.status === 'retake' && (
                  <Button
                    title="Report maintenance follow-up"
                    onPress={() => navigation.navigate('ReportMaintenance')}
                  />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      <PhotoReview
        asset={asset}
        remaining={Math.max(
          0,
          (record?.required || 0) - (record?.progress || 0),
        )}
        onDiscard={() => setAsset(undefined)}
        onAccept={() => accept(asset)}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  reviewList: { gap: 12 },
  root: { flex: 1, backgroundColor: colors.background },
  title: { ...layout.sectionTitle },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    resizeMode: 'contain',
    borderRadius: 14,
    backgroundColor: colors.readOnly,
  },
  row: { flexDirection: 'row', gap: 12 },
  stepButton: { flex: 1 },
});
