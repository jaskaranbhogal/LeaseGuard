import Header from '../../components/Header';
import PhotoReview from '../../components/PhotoReview';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  orange: '#E58212',
  orangeLight: '#FFF2DE',
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Header title="Request submitted" />
          <Text style={styles.subtitle}>
            Your maintenance request is saved. Your authorized landlord can now
            review it.
          </Text>
          <Pressable
            style={styles.submitButton}
            onPress={() =>
              navigation.replace('MaintenanceDetail', { requestId: draft.id })
            }
          >
            <Text style={styles.submitButtonText}>View saved request</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Header title="Report maintenance" titleStyle={styles.title} />
        <Text style={styles.subtitle}>
          Review and accept 5–20 photos. Each accepted photo is saved privately
          to your draft.
        </Text>
        {loading && <Text>Loading assigned units and draft…</Text>}
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
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
          <Text style={styles.removePhotoText}>Refresh / retry connection</Text>
        </Pressable>
        {!draft &&
          drafts.map(d => (
            <Pressable
              key={d.id}
              onPress={() =>
                navigation.replace('ReportMaintenance', { draftId: d.id })
              }
            >
              <Text style={styles.label}>
                Resume saved draft: {d.area} ({d.photos.length} photos)
              </Text>
            </Pressable>
          ))}
        {!loading && units.length === 0 && (
          <Text>
            No verified unit assignment. Contact your property manager.
          </Text>
        )}
        <Text style={styles.label}>Assigned unit</Text>
        {units.map(u => (
          <Pressable
            key={u.id}
            disabled={busy || !!draft}
            onPress={() => setUnitId(u.id)}
          >
            <Text style={styles.label}>
              {unitId === u.id ? '●' : '○'} {u.property} · {u.label}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.label}>Area</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Area"
          value={area}
          onChangeText={setArea}
          maxLength={100}
          editable={!busy && !loading}
          placeholder="e.g. Kitchen, sink"
        />
        <Text style={styles.descriptionLabel}>Description</Text>
        <TextInput
          style={styles.descriptionInput}
          accessibilityLabel="Description"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          editable={!busy && !loading}
          multiline
          placeholder="Describe what needs repair"
        />
        <Pressable
          disabled={busy}
          style={styles.urgencyCard}
          onPress={() =>
            setUrgency(v => (v === 'normal' ? 'urgent' : 'normal'))
          }
        >
          <Text>Urgency: {urgency} (tap to change)</Text>
        </Pressable>
        <Text style={styles.mediaLabel}>
          {readyCount} of 20 photos saved · minimum 5
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          disabled={busy || loading || full || !!retryAsset}
          onPress={add}
          style={styles.mediaCard}
        >
          <Text style={styles.mediaTitle}>+ Add photos</Text>
          <Text style={styles.mediaSubtitle}>
            Camera or gallery · JPEG/PNG · up to 8 MB / 20 MP
          </Text>
        </Pressable>
        {busy && (
          <Text accessibilityLiveRegion="polite">
            Saving… photo transfer {progress}% (waiting for server confirmation)
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
              <Text>{p.state}</Text>
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
        <Pressable
          disabled={busy || loading}
          style={styles.cancelButton}
          onPress={() => {
            if (valid())
              operation(async () => {
                await save();
              });
          }}
        >
          <Text style={styles.cancelButtonText}>Save draft</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || loading || readyCount < 5}
          style={[
            styles.submitButton,
            (busy || readyCount < 5) && styles.disabled,
          ]}
          onPress={() => {
            submit();
          }}
        >
          <Text style={styles.submitButtonText}>Submit request</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.footer}>
          {draft && !dirty
            ? 'Draft saved on server.'
            : 'Save your fields before leaving.'}{' '}
          Uploaded evidence is retained for at least 90 days. For immediate
          danger, contact local emergency services.
        </Text>
      </ScrollView>
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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 36,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 30,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 13,
  },
  disabled: { opacity: 0.65 },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  photoCard: { width: 88 },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: COLORS.border,
  },
  removePhoto: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  mediaLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  mediaCard: {
    height: 126,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingTop: 19,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  mediaTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  mediaSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 24,
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 48,
    maxHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 12,
  },
  urgencyCard: {
    minHeight: 72,
    marginTop: 20,
    backgroundColor: COLORS.orangeLight,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  urgencyBadge: {
    height: 26,
    width: 92,
    borderRadius: 13,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  urgencyBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  urgencyDetails: {
    flex: 1,
    paddingTop: 2,
  },
  urgencyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  urgencySubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 7,
    lineHeight: 15,
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 38,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  footer: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
