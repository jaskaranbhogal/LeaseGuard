import Icon from '../../components/Icon';
import Field from '../../components/Field';
import StateCard from '../../components/StateCard';
import ProgressBar from '../../components/ProgressBar';
import StatusBadge from '../../components/StatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import { layout } from '../../theme/layout';
import ScreenTitle from '../../components/ScreenTitle';
import ActionButton from '../../components/ActionButton';
import { typography } from '../../theme/typography';
import PhotoReview from '../../components/PhotoReview';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import * as maintenance from '../../services/maintenanceService';
import { normalizePhotoAsset } from '../../services/photoAsset';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<TenantStackParamList, 'ReportMaintenance'>;

export default function ReportMaintenanceScreen({ navigation, route }: Props) {
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [units, setUnits] = useState<maintenance.AssignedUnit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [draft, setDraft] = useState<maintenance.MaintenanceRequest>();
  const [drafts, setDrafts] = useState<maintenance.MaintenanceRequest[]>([]);
  const [queue, setQueue] = useState<Asset[]>([]);
  const [retryAsset, setRetryAsset] = useState<Asset>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const working = useRef(false);
  const creationKey = useRef(
    `maintenance_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  const dirty =
    area !== (draft?.area || '') ||
    description !== (draft?.description || '') ||
    urgency !== (draft?.urgency || 'normal');
  const readyCount =
    draft?.photos.filter(p => p.state === 'ready' && p.available).length || 0;
  const full = (draft?.photos.length || 0) >= 20;
  usePreventRemove(
    !done && (busy || dirty || queue.length > 0 || !!retryAsset),
    ({ data }) => {
      if (working.current) {
        Alert.alert(
          'Please wait',
          'Wait for the current operation to finish before leaving.',
        );
        return;
      }
      Alert.alert(
        'Leave report?',
        'Uploaded photos and saved fields remain in your draft. Unsaved edits and unuploaded photos will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Leave', onPress: () => navigation.dispatch(data.action) },
        ],
      );
    },
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const assigned = await maintenance.assignedUnits();
      setUnits(assigned);
      setUnitId(assigned[0]?.id || '');
      if (route.params?.draftId) {
        const saved = await maintenance.getMaintenance(route.params.draftId);
        if (saved.status !== 'draft') {
          setDone(true);
          setDraft(saved);
        } else {
          setDraft(saved);
          setArea(saved.area);
          setDescription(saved.description);
          setUrgency(saved.urgency);
          setUnitId(saved.unit_id);
        }
      } else {
        const page = await maintenance.listMaintenance();
        setDrafts(page.requests.filter(r => r.status === 'draft'));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [route.params?.draftId]);
  useEffect(() => {
    load();
  }, [load]);
  const fields = {
    area: area.trim(),
    description: description.trim(),
    urgency,
  };
  function valid() {
    const missing = [
      !unitId && 'choose your unit',
      !fields.area && 'enter the area',
      !fields.description && 'describe the problem',
    ].filter(Boolean);
    if (missing.length) {
      setError(
        `Before adding photos, ${missing.join(
          ' and ',
        )}. Photos are saved to a draft request, which needs these first.`,
      );
      return false;
    }
    return true;
  }
  async function save() {
    if (draft) {
      const current = await maintenance.getMaintenance(draft.id);
      if (current.status !== 'draft') {
        setDraft(current);
        setDone(true);
        return current;
      }
    }
    const saved = draft
      ? await maintenance.saveDraft(draft.id, fields)
      : await maintenance.createDraft(unitId, fields, creationKey.current);
    setDraft(saved);
    setArea(saved.area);
    setDescription(saved.description);
    return saved;
  }
  async function operation(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function accept(asset: Asset) {
    if (working.current) return;
    if (!valid()) {
      setQueue([]);
      return;
    }
    if (!retryAsset) setQueue(items => items.slice(1));
    await operation(async () => {
      setRetryAsset(asset);
      setProgress(0);
      const saved = await save();
      if (saved.status !== 'draft') {
        setRetryAsset(undefined);
        return;
      }
      const uploaded = await maintenance.uploadMaintenancePhoto(
        saved.id,
        asset,
        setProgress,
      );
      setDraft(uploaded);
      setRetryAsset(undefined);
    });
  }
  async function pick(source: 'camera' | 'library') {
    if (full || retryAsset) return;
    if (!valid()) return;
    await operation(async () => {
      const options = {
        mediaType: 'photo' as const,
        quality: 0.8 as const,
        maxWidth: 4000,
        maxHeight: 4000,
      };
      const result =
        source === 'camera'
          ? await launchCamera({
              ...options,
              cameraType: 'back',
              saveToPhotos: false,
            })
          : await launchImageLibrary({
              ...options,
              selectionLimit: 20 - (draft?.photos.length || 0),
              assetRepresentationMode: 'compatible',
            });
      if (result.didCancel) return;
      if (result.errorCode)
        throw new Error(
          result.errorCode === 'permission'
            ? 'Allow camera or photo access in device Settings.'
            : 'Camera or gallery unavailable. Try the other source.',
        );
      const assets = (result.assets || [])
        .filter(a => a.uri)
        .map(normalizePhotoAsset);
      if (
        assets.some(
          a =>
            (a.fileSize || 0) > 8 * 1024 * 1024 ||
            (a.type && !['image/jpeg', 'image/png'].includes(a.type)),
        )
      )
        throw new Error('Choose JPEG/PNG photos under 8 MB.');
      setQueue(assets.slice(0, 20 - (draft?.photos.length || 0)));
    });
  }
  function add() {
    Alert.alert('Add Photos', 'How would you like to add a photo?', [
      {
        text: 'Take Photo',
        onPress: () => {
          pick('camera');
        },
      },
      {
        text: 'Choose from Library',
        onPress: () => {
          pick('library');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  async function submit() {
    if (!valid()) return;
    if (
      readyCount < 5 ||
      readyCount > 20 ||
      draft?.photos.some(p => p.state !== 'ready') ||
      retryAsset ||
      queue.length
    ) {
      setError(
        'Securely upload 5–20 accepted photos. Retry or remove failed uploads before submitting.',
      );
      return;
    }
    await operation(async () => {
      const saved = await save();
      const submitted =
        saved.status === 'draft'
          ? await maintenance.submitMaintenance(saved.id)
          : saved;
      if (submitted.status === 'draft')
        throw new Error(
          'Submission has not been confirmed. Refresh and retry.',
        );
      setDraft(submitted);
      setDone(true);
    });
  }
  if (done && draft)
    return (
      <ScreenContainer style={styles.doneContent}>
        <View style={styles.check}>
          <Icon name="check" size={34} color={colors.successText} />
        </View>
        <Text accessibilityRole="header" style={styles.doneTitle}>
          Request submitted
        </Text>
        <Text style={styles.doneBody}>
          Your maintenance request is saved. Your landlord can now review it.
        </Text>
        <View style={styles.spacer} />
        <ActionButton
          title="View saved request"
          onPress={() =>
            navigation.replace('MaintenanceDetail', { requestId: draft.id })
          }
        />
      </ScreenContainer>
    );
  const blocked = busy || loading || full || !!retryAsset;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ScreenTitle
            title="Report maintenance"
            subtitle="Tell your landlord what needs fixing. Add 5–20 photos so they can see the problem."
            onBack={() => {
              if (!busy) navigation.goBack();
            }}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh / retry connection"
                disabled={busy}
                hitSlop={8}
                onPress={() => {
                  draft
                    ? operation(async () => {
                        setDraft(await maintenance.getMaintenance(draft.id));
                      })
                    : load();
                }}
              >
                <Text style={styles.link}>Refresh</Text>
              </Pressable>
            }
          />
          {loading && (
            <StateCard title="Loading assigned units and draft…" loading />
          )}
          {!!error && (
            <Text style={layout.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          {!draft &&
            drafts.map(d => (
              <Pressable
                key={d.id}
                style={styles.resume}
                accessibilityRole="button"
                onPress={() =>
                  navigation.replace('ReportMaintenance', { draftId: d.id })
                }
              >
                <Text style={styles.resumeTitle}>Resume saved draft</Text>
                <Text style={styles.resumeBody}>
                  {`${d.area} • ${d.photos.length} photos`}
                </Text>
              </Pressable>
            ))}
          {!loading && units.length === 0 && (
            <Text style={styles.warn}>
              No verified unit assignment. Contact your property manager.
            </Text>
          )}
          {units.length > 1 && (
            <View style={styles.group}>
              <Text style={styles.label}>Unit</Text>
              {units.map(u => (
                <Pressable
                  key={u.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${u.property} · ${u.label}`}
                  accessibilityState={{
                    checked: unitId === u.id,
                    disabled: busy || !!draft,
                  }}
                  style={[styles.choice, unitId === u.id && styles.selected]}
                  disabled={busy || !!draft}
                  onPress={() => setUnitId(u.id)}
                >
                  <Text style={styles.choiceText}>
                    {`${u.property} • ${u.label}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {units.length === 1 && (
            <Text style={styles.unitLine}>
              {`${units[0].property} • ${units[0].label}`}
            </Text>
          )}
          <Field
            label="Area"
            value={area}
            onChangeText={setArea}
            maxLength={100}
            editable={!busy && !loading}
            placeholder="e.g. Kitchen • Sink"
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            editable={!busy && !loading}
            multiline
            placeholder="Describe what needs repair…"
          />
          <View style={styles.group}>
            <Text style={styles.label}>Photos</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              disabled={blocked}
              onPress={add}
              style={[styles.mediaCard, blocked && styles.disabled]}
            >
              <View style={styles.plus}>
                <Text style={styles.plusText}>+</Text>
              </View>
              <Text style={styles.mediaTitle}>Add photos</Text>
              <Text style={styles.mediaSubtitle}>
                {!draft && (!area.trim() || !description.trim())
                  ? 'Fill in the area and description first'
                  : `${readyCount} of 20 photos saved • minimum 5`}
              </Text>
            </Pressable>
            {readyCount > 0 && <ProgressBar value={readyCount / 20} />}
          </View>
          {busy && (
            <Text style={styles.status} accessibilityLiveRegion="polite">
              {`Saving… photo transfer ${progress}% (waiting for server confirmation)`}
            </Text>
          )}
          {retryAsset && !busy && (
            <View style={styles.retryCard}>
              <Text style={styles.resumeBody}>
                That photo didn't finish uploading.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  accept(retryAsset);
                }}
                hitSlop={6}
              >
                <Text style={styles.link}>Retry accepted photo</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRetryAsset(undefined)}
                hitSlop={6}
              >
                <Text style={styles.linkMuted}>
                  Discard local retry (remove any failed server entry below)
                </Text>
              </Pressable>
            </View>
          )}
          {!!draft?.photos.length && (
            <View style={styles.photos}>
              {draft.photos.map((p, index) => (
                <View key={p.id} style={styles.photoCard}>
                  {p.available ? (
                    <Image
                      source={{
                        uri: maintenance.maintenancePhotoUrl(draft.id, p.id),
                      }}
                      style={styles.photo}
                      accessibilityLabel={`Accepted photo ${index + 1}`}
                    />
                  ) : (
                    <View style={styles.photo} />
                  )}
                  <View style={styles.photoRow}>
                    <StatusBadge status={p.state} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      disabled={busy}
                      hitSlop={8}
                      onPress={() => {
                        operation(async () =>
                          setDraft(
                            await maintenance.removePhoto(draft.id, p.id),
                          ),
                        );
                      }}
                    >
                      <Text style={styles.link}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={styles.group}>
            <Text style={styles.label}>Urgency</Text>
            <View style={styles.priorityRow}>
              {(['normal', 'urgent'] as const).map(value => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} priority`}
                  accessibilityState={{
                    checked: urgency === value,
                    disabled: busy,
                  }}
                  disabled={busy}
                  style={[
                    styles.choice,
                    styles.priorityChoice,
                    urgency === value &&
                      (value === 'urgent' ? styles.urgent : styles.selected),
                  ]}
                  onPress={() => setUrgency(value)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      urgency === value && styles.choiceTextOn,
                      urgency === value &&
                        value === 'urgent' &&
                        styles.urgentText,
                    ]}
                  >
                    {value === 'normal' ? 'Normal' : 'Urgent'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              Choose urgent when the issue needs prompt attention. For immediate
              danger, contact local emergency services.
            </Text>
          </View>
          <ActionButton
            title="Submit request"
            disabled={busy || loading || readyCount < 5}
            onPress={submit}
          />
          <ActionButton
            title="Save draft"
            variant="secondary"
            disabled={busy || loading}
            onPress={() => {
              if (valid())
                operation(async () => {
                  await save();
                });
            }}
          />
          <ActionButton
            title="Cancel"
            variant="secondary"
            disabled={busy}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.footer}>
            {draft && !dirty
              ? 'Draft saved on server.'
              : 'Save your fields before leaving.'}{' '}
            Uploaded photos are kept for at least 90 days.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <PhotoReview
        asset={!busy && !retryAsset ? queue[0] : undefined}
        remaining={queue.length}
        onDiscard={() => setQueue(items => items.slice(1))}
        onAccept={() => {
          if (queue[0]) accept(queue[0]);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { ...layout.content },
  group: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: typography.medium,
    color: colors.muted,
  },
  hint: { fontSize: 12, lineHeight: 18, color: colors.muted },
  link: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  linkMuted: { fontSize: 13, color: colors.muted },
  unitLine: { fontSize: 13, color: colors.muted, marginTop: -6 },
  warn: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.warnBg,
    color: colors.warnText,
    fontSize: 14,
  },
  resume: {
    padding: 14,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  resumeTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  resumeBody: { fontSize: 13, color: colors.muted },
  choice: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  selected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  urgent: { borderColor: '#F2B8B5', backgroundColor: colors.errorTint },
  choiceText: { fontSize: 15, color: colors.ink },
  choiceTextOn: { fontWeight: typography.semibold, color: colors.brand },
  urgentText: { color: colors.error },
  priorityRow: { flexDirection: 'row', gap: 12 },
  priorityChoice: { flex: 1, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  mediaCard: {
    minHeight: 128,
    padding: 16,
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  mediaTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  mediaSubtitle: { fontSize: 13, color: colors.muted },
  status: { fontSize: 13, color: colors.muted },
  retryCard: {
    padding: 14,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F4D58A',
    backgroundColor: colors.warnBg,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoCard: {
    width: '48%',
    gap: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.readOnly,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  doneContent: { flexGrow: 1, paddingTop: 72, gap: 14 },
  check: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  doneBody: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  spacer: { flex: 1, minHeight: 24 },
  footer: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
