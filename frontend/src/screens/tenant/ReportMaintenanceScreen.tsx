import Button from '../../components/Button';
import Field from '../../components/Field';
import StateCard from '../../components/StateCard';
import ProgressBar from '../../components/ProgressBar';
import StatusBadge from '../../components/StatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import { layout } from '../../theme/layout';
import Header from '../../components/Header';
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
const COLORS = {
  background: colors.background,
  white: colors.white,
  primary: colors.brand,
  primaryLight: colors.brandSoft,
  text: colors.ink,
  muted: colors.muted,
  border: colors.cardBorder,
  orange: colors.warnText,
  orangeLight: colors.warnBg,
};

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
    if (!unitId || !fields.area || !fields.description) {
      setError(
        'Select an assigned unit and enter an area and description before saving photos.',
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
      <ScreenContainer>
        <Header title="Request submitted" />
        <Text style={styles.subtitle}>
          Your maintenance request is saved. Your authorized landlord can now
          review it.
        </Text>
        <Button
          title="View saved request"
          onPress={() =>
            navigation.replace('MaintenanceDetail', { requestId: draft.id })
          }
        />
      </ScreenContainer>
    );
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
          <Header
            title="Report maintenance"
            onBack={() => {
              if (!busy) navigation.goBack();
            }}
          />
          <Text style={styles.subtitle}>
            Review and accept 5–20 photos. Each accepted photo is saved
            privately to your draft.
          </Text>
          {loading && (
            <StateCard title="Loading assigned units and draft…" loading />
          )}
          {!!error && (
            <Text style={layout.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <Pressable
            disabled={busy}
            onPress={() => {
              draft
                ? operation(async () => {
                    setDraft(await maintenance.getMaintenance(draft.id));
                  })
                : load();
            }}
          >
            <Text style={styles.removePhotoText}>
              Refresh / retry connection
            </Text>
          </Pressable>
          {!draft &&
            drafts.map(d => (
              <Pressable
                key={d.id}
                style={layout.card}
                accessibilityRole="button"
                onPress={() =>
                  navigation.replace('ReportMaintenance', { draftId: d.id })
                }
              >
                <Text style={layout.body}>
                  Resume saved draft: {d.area} ({d.photos.length} photos)
                </Text>
              </Pressable>
            ))}
          {!loading && units.length === 0 && (
            <Text>
              No verified unit assignment. Contact your property manager.
            </Text>
          )}
          <View style={layout.card}>
            <Text style={layout.sectionTitle}>Request details</Text>
            <Text style={layout.label}>Assigned unit</Text>
            {units.map(u => (
              <Pressable
                key={u.id}
                accessibilityRole="radio"
                accessibilityLabel={`${u.property} · ${u.label}`}
                accessibilityState={{
                  checked: unitId === u.id,
                  disabled: busy || !!draft,
                }}
                style={[
                  styles.unitChoice,
                  unitId === u.id && styles.unitSelected,
                ]}
                disabled={busy || !!draft}
                onPress={() => setUnitId(u.id)}
              >
                <Text style={layout.body}>
                  {unitId === u.id ? '●' : '○'} {u.property} · {u.label}
                </Text>
              </Pressable>
            ))}
            <Field
              label="Area"
              value={area}
              onChangeText={setArea}
              maxLength={100}
              editable={!busy && !loading}
              placeholder="e.g. Kitchen, sink"
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              maxLength={2000}
              editable={!busy && !loading}
              multiline
              placeholder="Describe what needs repair"
            />
            <Text style={layout.label}>Priority</Text>
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
                    styles.unitChoice,
                    styles.priorityChoice,
                    urgency === value && styles.unitSelected,
                  ]}
                  onPress={() => setUrgency(value)}
                >
                  <Text style={layout.body}>
                    {urgency === value ? '✓ ' : ''}
                    {value === 'normal' ? 'Normal' : 'Urgent'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={layout.muted}>
              Choose urgent when the issue needs prompt attention. For immediate
              danger, contact local emergency services.
            </Text>
          </View>
          <View style={layout.card}>
            <Text style={layout.sectionTitle}>Photo evidence</Text>
            <Text style={layout.muted}>
              {readyCount} of 20 photos saved · minimum 5
            </Text>
            <ProgressBar value={readyCount / 20} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photos"
              disabled={busy || loading || full || !!retryAsset}
              onPress={add}
              style={[
                styles.mediaCard,
                (busy || loading || full || !!retryAsset) && styles.disabled,
              ]}
            >
              <Text style={styles.mediaTitle}>+ Add photos</Text>
              <Text style={styles.mediaSubtitle}>
                Camera or gallery · JPEG/PNG · up to 8 MB / 20 MP
              </Text>
            </Pressable>
          </View>
          {busy && (
            <Text accessibilityLiveRegion="polite">
              Saving… photo transfer {progress}% (waiting for server
              confirmation)
            </Text>
          )}
          {retryAsset && !busy && (
            <View>
              <Pressable
                onPress={() => {
                  accept(retryAsset);
                }}
              >
                <Text style={styles.removePhotoText}>Retry accepted photo</Text>
              </Pressable>
              <Pressable onPress={() => setRetryAsset(undefined)}>
                <Text>
                  Discard local retry (remove any failed server entry below)
                </Text>
              </Pressable>
            </View>
          )}
          <View style={styles.photos}>
            {draft?.photos.map((p, index) => (
              <View key={p.id} style={styles.photoCard}>
                {p.available && (
                  <Image
                    source={{
                      uri: maintenance.maintenancePhotoUrl(draft.id, p.id),
                    }}
                    style={styles.photo}
                    accessibilityLabel={`Accepted photo ${index + 1}`}
                  />
                )}
                <StatusBadge status={p.state} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  disabled={busy}
                  onPress={() => {
                    operation(async () =>
                      setDraft(await maintenance.removePhoto(draft.id, p.id)),
                    );
                  }}
                  style={styles.removePhoto}
                >
                  <Text style={styles.removePhotoText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Button
            title="Save draft"
            variant="outline"
            disabled={busy || loading}
            onPress={() => {
              if (valid())
                operation(async () => {
                  await save();
                });
            }}
          />
          <Button
            title="Submit request"
            disabled={busy || loading || readyCount < 5}
            onPress={submit}
          />
          <Button
            title="Back"
            variant="outline"
            disabled={busy}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.footer}>
            {draft && !dirty
              ? 'Draft saved on server.'
              : 'Save your fields before leaving.'}{' '}
            Uploaded evidence is retained for at least 90 days. For immediate
            danger, contact local emergency services.
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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: { ...layout.content },
  unitChoice: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    justifyContent: 'center',
  },
  unitSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  priorityChoice: { flexGrow: 1, flexBasis: '40%' },
  subtitle: {
    ...layout.muted,
  },
  disabled: { opacity: 0.65 },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  photoCard: {
    flexBasis: 140,
    flexGrow: 1,
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: COLORS.border,
  },
  removePhoto: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  mediaCard: {
    minHeight: 126,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    gap: 8,
  },
  mediaTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  mediaSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  footer: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
