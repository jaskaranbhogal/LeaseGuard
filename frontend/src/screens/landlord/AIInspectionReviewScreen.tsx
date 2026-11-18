import React, { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LandlordStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
import GuidedRecords from '../../components/GuidedRecords';
import LiveComparisonPanel from '../../components/LiveComparisonPanel';
import {
  comparisonPhotoUrl,
  getGuided,
  guidedAction,
  guidedPhotoUrl,
  GuidedInspection,
} from '../../services/guidedInspectionService';
export default function AIInspectionReviewScreen({
  route,
  navigation,
}: NativeStackScreenProps<LandlordStackParamList, 'AIInspectionReview'>) {
  const id = route.params?.inspectionId;
  const [record, setRecord] = useState<GuidedInspection>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [maintenance, setMaintenance] = useState('');
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
  async function action(name: string, data = {}) {
    if (!record || busy) return;
    setBusy(true);
    setError('');
    try {
      setRecord(await guidedAction(record, name, data));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.title}>Inspection review</Text>
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        {!id ? (
          <>
            <GuidedRecords
              onOpen={inspectionId => navigation.setParams({ inspectionId })}
            />
            <Text>Standalone photo comparison</Text>
            <LiveComparisonPanel />
          </>
        ) : (
          <>
            <Button
              title="Refresh inspection"
              disabled={busy}
              onPress={refresh}
            />
            {record && (
              <>
                <Text>
                  {record.property} · {record.unit} · {record.inspection_type} ·{' '}
                  {record.status}
                </Text>
                <Text>
                  Due {new Date(record.due_at).toLocaleDateString()} ·{' '}
                  {record.progress}/{record.required} photos
                </Text>
                {!record.baseline_available && (
                  <Text>No compatible approved baseline. Review manually.</Text>
                )}
                {record.photos.map(p => {
                  const previous = record.baseline_photos.find(
                    b => b.step_id === p.step_id && b.slot === p.slot,
                  );
                  const comparisons = record.comparisons.filter(
                    c => c.photo_id === p.id,
                  );
                  return (
                    <View key={p.id} style={styles.card}>
                      <Text style={styles.title}>
                        {record.steps.find(s => s.id === p.step_id)?.room} ·{' '}
                        {p.slot + 1}
                      </Text>
                      <View style={styles.pair}>
                        {previous && (
                          <View style={styles.half}>
                            <Text>Approved baseline</Text>
                            <Image
                              accessibilityLabel="Approved baseline photo"
                              style={styles.photo}
                              source={{
                                uri: guidedPhotoUrl(
                                  record.id,
                                  previous.id,
                                  true,
                                ),
                              }}
                            />
                          </View>
                        )}
                        <View style={styles.half}>
                          <Text>Current evidence</Text>
                          <Image
                            accessibilityLabel="Current inspection photo"
                            style={styles.photo}
                            source={{ uri: guidedPhotoUrl(record.id, p.id) }}
                          />
                        </View>
                      </View>
                      {previous && record.status === 'submitted' && (
                        <Button
                          title="Analyze with Gemini"
                          disabled={busy}
                          onPress={() => action('compare', { photo_id: p.id })}
                        />
                      )}
                      {comparisons.map(c => (
                        <View key={c.id} style={styles.card}>
                          <Text>
                            AI advisory · Human review required · {c.status}
                          </Text>
                          <Text>
                            {c.result?.summary ||
                              'Analysis pending. Refresh to recover its result.'}
                          </Text>
                          {c.baseline_photo_id && c.current_photo_id && (
                            <View style={styles.pair}>
                              <View style={styles.half}>
                                <Text>Baseline used for this analysis</Text>
                                <Image
                                  accessibilityLabel="Analyzed baseline"
                                  style={styles.photo}
                                  source={{
                                    uri: comparisonPhotoUrl(
                                      record.id,
                                      c.baseline_photo_id,
                                      c.id,
                                    ),
                                  }}
                                />
                              </View>
                              <View style={styles.half}>
                                <Text>
                                  Current photo used for this analysis
                                </Text>
                                <Image
                                  accessibilityLabel="Analyzed current photo"
                                  style={styles.photo}
                                  source={{
                                    uri: comparisonPhotoUrl(
                                      record.id,
                                      c.current_photo_id,
                                      c.id,
                                    ),
                                  }}
                                />
                              </View>
                            </View>
                          )}
                          {c.status === 'pending' &&
                            record.status === 'submitted' && (
                              <Button
                                title="Recover pending analysis"
                                disabled={busy}
                                onPress={() =>
                                  action('compare', { photo_id: c.photo_id })
                                }
                              />
                            )}
                          {c.result && (
                            <>
                              <Text>
                                {c.result.classification} ·{' '}
                                {c.result.severity || 'No severity'} ·
                                Confidence: {c.result.confidence}
                              </Text>
                              <Text>{JSON.stringify(c.result.findings)}</Text>
                            </>
                          )}
                          <Text>
                            Decision: {c.decision || 'Awaiting review'}
                          </Text>
                          {record.status === 'submitted' &&
                            c.status === 'completed' && (
                              <>
                                {[
                                  'confirmed',
                                  'dismissed',
                                  'manual-review',
                                ].map(decision => (
                                  <Button
                                    key={decision}
                                    title={decision}
                                    disabled={busy}
                                    onPress={() =>
                                      action('decision', {
                                        comparison_id: c.id,
                                        decision,
                                      })
                                    }
                                  />
                                ))}
                                {c.decision === 'confirmed' && (
                                  <>
                                    <TextInput
                                      style={styles.input}
                                      accessibilityLabel="Submitted maintenance request ID"
                                      placeholder="Submitted maintenance request ID"
                                      value={maintenance}
                                      onChangeText={setMaintenance}
                                    />
                                    <Button
                                      title="Link maintenance follow-up"
                                      disabled={busy || !maintenance}
                                      onPress={() =>
                                        action('maintenance', {
                                          comparison_id: c.id,
                                          maintenance_id: maintenance,
                                        })
                                      }
                                    />
                                  </>
                                )}
                              </>
                            )}
                          {!!c.maintenance_id && (
                            <Button
                              title="Open linked maintenance"
                              onPress={() =>
                                navigation.navigate('SavedMaintenanceDetail', {
                                  requestId: c.maintenance_id!,
                                })
                              }
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  );
                })}
                {record.comparisons
                  .filter(c => !record.photos.some(p => p.id === c.photo_id))
                  .map(c => (
                    <View key={c.id} style={styles.card}>
                      <Text style={styles.title}>
                        Historical analysis · replaced evidence
                      </Text>
                      <Text>
                        {c.result?.summary || 'Analysis pending'} ·{' '}
                        {c.decision || 'Awaiting human review'}
                      </Text>
                      {c.baseline_photo_id && c.current_photo_id && (
                        <View style={styles.pair}>
                          <View style={styles.half}>
                            <Text>Baseline used</Text>
                            <Image
                              style={styles.photo}
                              source={{
                                uri: comparisonPhotoUrl(
                                  record.id,
                                  c.baseline_photo_id,
                                  c.id,
                                ),
                              }}
                            />
                          </View>
                          <View style={styles.half}>
                            <Text>Previous evidence</Text>
                            <Image
                              style={styles.photo}
                              source={{
                                uri: comparisonPhotoUrl(
                                  record.id,
                                  c.current_photo_id,
                                  c.id,
                                ),
                              }}
                            />
                          </View>
                        </View>
                      )}
                      {record.status === 'submitted' &&
                        c.status === 'completed' &&
                        ['confirmed', 'dismissed', 'manual-review'].map(
                          decision => (
                            <Button
                              key={decision}
                              title={`Historical: ${decision}`}
                              disabled={busy}
                              onPress={() =>
                                action('decision', {
                                  comparison_id: c.id,
                                  decision,
                                })
                              }
                            />
                          ),
                        )}
                    </View>
                  ))}
                {record.inspection_type === 'move-in' &&
                  ['submitted', 'reviewed'].includes(record.status) && (
                    <Button
                      title="Approve move-in baseline"
                      disabled={busy}
                      onPress={() => action('approve-baseline')}
                    />
                  )}
                {record.status === 'submitted' && (
                  <>
                    <TextInput
                      style={styles.input}
                      accessibilityLabel="Retake reason"
                      placeholder="Clarification or retake instructions"
                      value={reason}
                      onChangeText={setReason}
                    />
                    <Button
                      title="Request retake"
                      disabled={busy || !reason.trim()}
                      onPress={() => action('retake', { reason })}
                    />
                    <Button
                      title="Finalize review"
                      disabled={busy}
                      onPress={() => action('finalize')}
                    />
                  </>
                )}
                <Text style={styles.title}>Decision and evidence history</Text>
                {record.history.map((h, i) => (
                  <Text key={i}>
                    {new Date(h.at).toLocaleString()} · {h.action}
                    {h.reason ? ` · ${h.reason}` : ''}
                  </Text>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 12, gap: 12 },
  pair: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  photo: { width: '100%', height: 220, resizeMode: 'contain' },
  input: {
    borderWidth: 1,
    borderColor: '#D6DEEB',
    padding: 12,
    borderRadius: 12,
  },
});
