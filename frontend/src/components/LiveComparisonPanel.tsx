import { colors } from '../theme/colors';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import {
  type Comparison,
  recentComparisons,
  setComparisonDecision,
  uploadComparison,
} from '../services/inspectionService';

/**
 * A self-owned comparison proof of concept for landlord accounts.
 * This is deliberately separate from tenant/property assignments, which
 * need their own authorization and data model before multi-user sharing.
 */
export default function LiveComparisonPanel() {
  const [baseline, setBaseline] = useState<Asset | null>(null);
  const [current, setCurrent] = useState<Asset | null>(null);
  const [room, setRoom] = useState('Living room');
  const [area, setArea] = useState('North wall');
  const [notes, setNotes] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function selectPhoto(which: 'baseline' | 'current', camera: boolean) {
    setMessage('');
    try {
      const result = camera
        ? await launchCamera({ mediaType: 'photo', saveToPhotos: false })
        : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel) return;
      if (result.errorCode || !result.assets?.[0]?.uri) {
        setMessage(
          'Unable to select that photo. Check permissions or try the gallery.',
        );
        return;
      }
      if (which === 'baseline') setBaseline(result.assets[0]);
      else setCurrent(result.assets[0]);
      setComparison(null);
    } catch {
      setMessage('Unable to access the camera or library.');
    }
  }

  async function compare() {
    if (!baseline || !current || !room.trim() || !area.trim()) {
      setMessage('Choose both photos and enter a room and area.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const saved = await uploadComparison(
        baseline,
        current,
        room,
        area,
        notes,
      );
      setComparison(saved);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Comparison could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadRecent() {
    setBusy(true);
    setMessage('');
    try {
      const saved = await recentComparisons();
      if (saved.length) {
        setComparison(saved[0]);
      } else {
        setMessage('No comparisons saved for this account.');
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load recent comparisons.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: 'confirmed' | 'dismissed' | 'resolved') {
    if (!comparison) return;
    setBusy(true);
    setMessage('');
    try {
      setComparison(await setComparisonDecision(comparison.id, action));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not save your review.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Live photo comparison (experimental)</Text>
      <Text style={styles.note}>
        Upload a move-in baseline and current photo. Photos are saved privately
        for at least 90 days. AI findings are suggestions only; final decisions
        require human review.
      </Text>
      <TextInput
        accessibilityLabel="Comparison room"
        style={styles.input}
        value={room}
        onChangeText={setRoom}
        maxLength={100}
        placeholder="Room"
      />
      <TextInput
        accessibilityLabel="Comparison area"
        style={styles.input}
        value={area}
        onChangeText={setArea}
        maxLength={100}
        placeholder="Area"
      />
      <TextInput
        accessibilityLabel="Comparison notes"
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        maxLength={1200}
        placeholder="Optional observations"
        multiline
      />

      {(['baseline', 'current'] as const).map(which => {
        const photo = which === 'baseline' ? baseline : current;
        return (
          <View key={which} style={styles.photoCard}>
            <Text style={styles.label}>
              {which === 'baseline' ? 'Move-in baseline' : 'Current photo'}
            </Text>
            {photo?.uri ? (
              <Image source={{ uri: photo.uri }} style={styles.preview} />
            ) : (
              <Text style={styles.note}>No photo selected</Text>
            )}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  selectPhoto(which, true);
                }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Take photo</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  selectPhoto(which, false);
                }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Choose photo</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compare uploaded photos"
        disabled={busy}
        onPress={() => {
          compare();
        }}
        style={[styles.primary, busy && styles.disabled]}
      >
        <Text style={styles.primaryText}>Compare and save photos</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Load most recent comparison"
        disabled={busy}
        onPress={() => {
          loadRecent();
        }}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Load most recent comparison</Text>
      </Pressable>
      {busy && (
        <ActivityIndicator accessibilityLabel="Loading photo comparison" />
      )}
      {!!message && (
        <Text accessibilityRole="alert" style={styles.error}>
          {message}
        </Text>
      )}
      {comparison && (
        <View style={styles.result}>
          <Text style={styles.label}>
            Saved comparison · {comparison.status}
          </Text>
          <Text style={styles.note}>
            {comparison.room} · {comparison.area}
          </Text>
          {comparison.result ? (
            <>
              <Text style={styles.heading}>
                {comparison.result.analysis_status === 'unavailable'
                  ? 'AI unavailable — manual review required'
                  : `Suggested classification: ${comparison.result.classification}`}
              </Text>
              <Text style={styles.note}>{comparison.result.summary}</Text>
              {comparison.result.severity && (
                <Text style={styles.note}>
                  Suggested severity: {comparison.result.severity}
                </Text>
              )}
              {comparison.result.findings.map((finding, index) => (
                <Text key={index} style={styles.note}>
                  • {finding.description}
                </Text>
              ))}
              <Text style={styles.note}>
                Your review: {comparison.decision || 'Not reviewed'}
              </Text>
              <View style={styles.actions}>
                {(['confirmed', 'dismissed', 'resolved'] as const).map(
                  action => (
                    <Pressable
                      key={action}
                      accessibilityRole="button"
                      accessibilityLabel={`Save decision: ${action}`}
                      disabled={
                        busy ||
                        comparison.result?.analysis_status !== 'completed'
                      }
                      onPress={() => {
                        decide(action);
                      }}
                      style={styles.button}
                    >
                      <Text style={styles.buttonText}>{action}</Text>
                    </Pressable>
                  ),
                )}
              </View>
            </>
          ) : (
            <Text style={styles.note}>
              Processing; check recent comparisons shortly.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    backgroundColor: colors.white,
    padding: 16,
    gap: 12,
  },
  heading: { color: colors.navy, fontSize: 18, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 10,
    color: colors.navy,
  },
  photoCard: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  label: { color: colors.navy, fontSize: 14, fontWeight: '600' },
  preview: { width: '100%', height: 140, borderRadius: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
  },
  buttonText: { color: colors.brand, fontWeight: '600', fontSize: 13 },
  primary: {
    minHeight: 52,
    justifyContent: 'center',
    padding: 14,
    backgroundColor: colors.brand,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  secondary: {
    minHeight: 44,
    justifyContent: 'center',
    padding: 10,
    alignItems: 'center',
  },
  secondaryText: { color: colors.brand, fontSize: 13 },
  error: { color: colors.error, fontSize: 13 },
  result: {
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    gap: 10,
  },
});
