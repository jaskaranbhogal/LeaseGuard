import ScreenTitle from '../../components/ScreenTitle';
import PhotoTile from '../../components/PhotoTile';
import { View } from 'react-native';
import { colors } from '../../theme/colors';
import EvidenceNotes from '../../components/EvidenceNotes';
import ProgressBar from '../../components/ProgressBar';
import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import type { LandlordStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
import PhotoReview from '../../components/PhotoReview';
import {
  createTemplate,
  getAssignmentOptions,
  type AssignmentOptions,
} from '../../services/guidedInspectionService';
import {
  saveBaselineNote,
  approveBaseline,
  baselinePhotoUrl,
  createBaseline,
  getBaselineDraft,
  getBaselines,
  uploadBaseline,
  versionPhotoUrl,
  type BaselineDraft,
  type BaselineHistory,
} from '../../services/baselineService';

export default function MoveInBaselineScreen({
  navigation,
  route,
}: NativeStackScreenProps<LandlordStackParamList, 'MoveInBaseline'>) {
  const [options, setOptions] = useState<AssignmentOptions>();
  const [unit, setUnit] = useState('');
  const [history, setHistory] = useState<BaselineHistory>();
  const [draft, setDraft] = useState<BaselineDraft>();
  const [asset, setAsset] = useState<Asset>();
  const [retryAsset, setRetryAsset] = useState<Asset>();
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useFocusEffect(
    useCallback(() => {
      getAssignmentOptions()
        .then(async o => {
          setOptions(o);
          if (route.params?.unitId) await selectUnit(route.params.unitId);
        })
        .catch(e => setError(e.message));
    }, [route.params?.unitId]),
  );
  async function selectUnit(id: string) {
    // Clear the previous unit before the request; a failed request must never
    // leave another unit's draft available for capture or approval.
    setUnit(id);
    setDraft(undefined);
    setHistory(undefined);
    setReview(false);
    setIndex(0);
    setAsset(undefined);
    setRetryAsset(undefined);
    setHistory(await getBaselines(id));
  }
  const slots =
    draft?.steps.flatMap(s =>
      Array.from({ length: s.count }, (_, slot) => ({ ...s, slot })),
    ) || [];
  const step = slots[index];
  const saved = draft?.photos.find(
    p => p.step_id === step?.id && p.slot === step?.slot,
  );
  async function pick(camera: boolean) {
    const result = await (camera ? launchCamera : launchImageLibrary)({
      mediaType: 'photo',
      selectionLimit: 1,
      assetRepresentationMode: 'compatible',
      quality: 0.8,
    });
    if (result.errorCode)
      throw new Error(
        result.errorMessage || 'Check camera/gallery permissions.',
      );
    if (result.assets?.[0]) setAsset(result.assets[0]);
  }
  async function accept(selected: Asset | undefined) {
    if (!draft || !step || !selected) return;
    setAsset(undefined);
    setRetryAsset(selected);
    setProgress(0);
    await run(async () => {
      setDraft(
        await uploadBaseline(draft, step.id, step.slot, selected, setProgress),
      );
      setRetryAsset(undefined);
      setIndex(i => Math.min(i + 1, slots.length - 1));
    });
  }
  async function approve() {
    if (!draft) return;
    await run(async () => {
      setDraft(await approveBaseline(draft));
      setHistory(await getBaselines(unit));
      setReview(false);
    });
  }
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <ScreenTitle
          title="Move-in baselines"
          onBack={() => {
            if (!busy) navigation.goBack();
          }}
        />
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        <Button
          title="Refresh units"
          disabled={busy}
          onPress={() =>
            run(async () => {
              setOptions(await getAssignmentOptions());
            })
          }
        />
        <Text>Select an authorized property and unit</Text>
        {options?.units.map(u => (
          <Button
            key={u.id}
            title={`${u.property} · ${u.label}${unit === u.id ? ' ✓' : ''}`}
            disabled={busy}
            onPress={() => run(() => selectUnit(u.id))}
          />
        ))}
        {history && (
          <>
            <Text>Baseline status: {history.status}</Text>
            {history.active_id && (
              <Text>
                Replacing this baseline requires explicit confirmation. All
                previous evidence is preserved.
              </Text>
            )}
            {history.drafts.map(d => (
              <Button
                key={d.id}
                title={`Resume draft · ${d.progress}/${d.required}`}
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    setDraft(await getBaselineDraft(d.id));
                    setIndex(0);
                    setReview(false);
                  })
                }
              />
            ))}
            {(!draft || draft.status === 'reviewed') && (
              <>
                <Text>Create Move-In Baseline — select a saved template</Text>
                {options?.templates.map(t => (
                  <Button
                    key={t.id}
                    title={`${t.name} · v${t.version}`}
                    disabled={busy}
                    onPress={() =>
                      run(async () =>
                        setDraft(await createBaseline(unit, t.id)),
                      )
                    }
                  />
                ))}
                <Button
                  title="Create standard five-room template"
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      if (!options) return;
                      const t = await createTemplate(
                        'Move-in five-room layout',
                        options.units.find(u => u.id === unit)
                          ?.configured_steps || options.default_steps,
                      );
                      setOptions(await getAssignmentOptions());
                      setDraft(await createBaseline(unit, t.id));
                    })
                  }
                />
              </>
            )}
          </>
        )}
        {draft && (
          <>
            <ProgressBar value={draft.progress / draft.required} />
            <Text>
              {draft.status} · {draft.progress}/{draft.required} photos securely
              saved
            </Text>
            <Button
              title="Refresh saved draft"
              disabled={busy}
              onPress={() =>
                run(async () => setDraft(await getBaselineDraft(draft.id)))
              }
            />
            {step && !review && (
              <>
                <Text style={styles.title}>
                  {index + 1}. {step.room} · Photo {step.slot + 1}
                </Text>
                <Text>{step.instructions}</Text>
                {saved && (
                  <Image
                    accessibilityLabel="Saved baseline photo"
                    style={styles.photo}
                    source={{ uri: baselinePhotoUrl(draft.id, saved.id) }}
                  />
                )}
                {saved && (
                  <EvidenceNotes
                    notes={saved.notes}
                    busy={busy}
                    baseline
                    onSave={
                      draft.status === 'draft'
                        ? (note, kind) =>
                            run(async () =>
                              setDraft(
                                await saveBaselineNote(
                                  draft,
                                  saved.id,
                                  note,
                                  kind,
                                ),
                              ),
                            )
                        : undefined
                    }
                  />
                )}
                {busy && (
                  <Text>
                    {progress < 100
                      ? `Transferring ${progress}%`
                      : 'Waiting for secure storage confirmation…'}
                  </Text>
                )}
                {draft.status === 'draft' && (
                  <>
                    <Button
                      title={saved ? 'Replace with camera photo' : 'Take photo'}
                      disabled={busy}
                      onPress={() => run(() => pick(true))}
                    />
                    <Button
                      title="Choose from gallery"
                      disabled={busy}
                      onPress={() => run(() => pick(false))}
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
                <Button
                  title="Previous"
                  disabled={busy || index === 0}
                  onPress={() => {
                    setIndex(index - 1);
                    setRetryAsset(undefined);
                  }}
                />
                <Button
                  title="Next"
                  disabled={busy || index === slots.length - 1}
                  onPress={() => {
                    setIndex(index + 1);
                    setRetryAsset(undefined);
                  }}
                />
              </>
            )}
            {review &&
              draft.photos.map(p => (
                <EvidenceNotes key={p.id} notes={p.notes} />
              ))}
            {!!draft.uploads.length && (
              <Text>
                Recover interrupted uploads by selecting the same photo after
                the 90-second lease expires.
              </Text>
            )}
            {!draft.history.some(h => h.action === 'baseline-approved') && (
              <Button
                title={review ? 'Return to capture' : 'Review full baseline'}
                disabled={busy || draft.progress !== draft.required}
                onPress={() => setReview(!review)}
              />
            )}
            {review && (
              <>
                <View style={styles.reviewGrid}>
                  {draft.photos.map(p => (
                    <PhotoTile
                      key={p.id}
                      area={
                        draft.steps.find(s => s.id === p.step_id)?.room ||
                        p.step_id
                      }
                      uri={baselinePhotoUrl(draft.id, p.id)}
                      placeholder="Saved evidence"
                      onRetake={
                        draft.status === 'draft'
                          ? () => {
                              setIndex(
                                slots.findIndex(
                                  s => s.id === p.step_id && s.slot === p.slot,
                                ),
                              );
                              setReview(false);
                            }
                          : undefined
                      }
                    />
                  ))}
                </View>
                <Button
                  title="Approve and Save Baseline"
                  disabled={busy}
                  onPress={() => {
                    if (draft.expected_active_id)
                      Alert.alert(
                        'Supersede approved baseline?',
                        'This creates a new version and preserves the previous baseline and analyses.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Supersede and approve', onPress: approve },
                        ],
                      );
                    else approve();
                  }}
                />
              </>
            )}
          </>
        )}
        {history?.versions.map(v => (
          <React.Fragment key={v.id}>
            <Text>
              {v.status} baseline · {new Date(v.approved_at).toLocaleString()} ·{' '}
              {v.source}
            </Text>
            {v.photos.map(p => (
              <View key={p.id}>
                <EvidenceNotes notes={p.notes} />
                <Image
                  key={p.id}
                  accessibilityLabel={`${v.status} baseline evidence`}
                  style={styles.photo}
                  source={{ uri: versionPhotoUrl(unit, v.id, p.id) }}
                />
              </View>
            ))}
          </React.Fragment>
        ))}
      </ScrollView>
      <PhotoReview
        asset={asset}
        remaining={Math.max(0, (draft?.required || 0) - (draft?.progress || 0))}
        onDiscard={() => setAsset(undefined)}
        onAccept={() => accept(asset)}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  photo: { width: '100%', height: 260, resizeMode: 'contain' },
});
