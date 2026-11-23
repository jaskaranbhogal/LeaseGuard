import EvidenceImage from '../../components/EvidenceImage';
import { layout } from '../../theme/layout';
import StateCard from '../../components/StateCard';
import StatusBadge from '../../components/StatusBadge';
import ScreenTitle from '../../components/ScreenTitle';
import { colors } from '../../theme/colors';
import EvidenceNotes from '../../components/EvidenceNotes';
import React, { useCallback, useState } from 'react';
import {
  Alert,
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={layout.content}
      >
        <ScreenTitle
          title="Inspection review"
          onBack={() => {
            if (!busy) navigation.goBack();
          }}
        />
        {!!error && (
          <Text style={layout.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {!id ? (
          <>
            <GuidedRecords
              onOpen={inspectionId => navigation.setParams({ inspectionId })}
            />
            <Text style={layout.body}>Standalone photo comparison</Text>
            <LiveComparisonPanel />
          </>
        ) : (
          <>
            <Button
              title="Refresh inspection"
              variant="outline"
              disabled={busy}
              onPress={refresh}
            />
            {record && (
              <>
                <StatusBadge status={record.status} />
                <Text style={layout.body}>
                  {record.property} · {record.unit} · {record.inspection_type} ·{' '}
                  {record.status}
                </Text>
                <Text style={layout.body}>
                  Due {new Date(record.due_at).toLocaleDateString()} ·{' '}
                  {record.progress}/{record.required} photos
                </Text>
                {!record.baseline_available && (
                  <Text style={layout.body}>
                    No compatible approved baseline. Review manually.
                  </Text>
                )}
                {!record.photos.length && (
                  <StateCard
                    title="Waiting for photo evidence"
                    message="The tenant's saved photos will appear here. AI analysis is available after submission and requires your explicit request."
                  />
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
                            <Text style={layout.body}>Approved baseline</Text>
                            <EvidenceImage
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
                          <Text style={layout.body}>Current evidence</Text>
                          <EvidenceImage
                            accessibilityLabel="Current inspection photo"
                            style={styles.photo}
                            source={{ uri: guidedPhotoUrl(record.id, p.id) }}
                          />
                        </View>
                      </View>
                      {previous && <EvidenceNotes notes={previous.notes} />}
                      <EvidenceNotes notes={p.notes} />
                      {previous && record.status === 'submitted' && (
                        <Button
                          title="Analyze with Gemini"
                          disabled={busy}
                          onPress={() => action('compare', { photo_id: p.id })}
                        />
                      )}
                      {comparisons.map(c => (
                        <View key={c.id} style={styles.card}>
                          <Text style={layout.body}>
                            AI advisory · Human review required · {c.status}
                          </Text>
                          <Text style={layout.body}>
                            {c.result?.summary ||
                              'Analysis pending. Refresh to recover its result.'}
                          </Text>
                          <EvidenceNotes notes={c.baseline_notes} />
                          <EvidenceNotes notes={c.current_notes} />
                          {c.result && (
                            <View style={styles.assessment}>
                              <Text style={layout.body}>
                                AI photo-quality assessment:{' '}
                                {c.result.photo_quality || 'Unknown'}
                              </Text>
                              <Text style={layout.body}>
                                Same-area assessment:{' '}
                                {c.result.same_area === true
                                  ? 'Likely same area'
                                  : c.result.same_area === false
                                  ? 'Different area'
                                  : 'Uncertain'}
                              </Text>
                              <Text style={layout.body}>
                                Classification:{' '}
                                {c.result.analysis_status === 'unavailable'
                                  ? 'Unavailable · manual review required'
                                  : c.result.classification}
                              </Text>
                              <Text style={layout.body}>
                                Severity: {c.result.severity || 'Not assessed'}{' '}
                                · Confidence: {c.result.confidence}
                              </Text>
                              {!!c.result.obstructed_areas && (
                                <Text style={layout.body}>
                                  Obstructions / retake guidance:{' '}
                                  {c.result.obstructed_areas}
                                </Text>
                              )}
                            </View>
                          )}
                          {c.baseline_photo_id && c.current_photo_id && (
                            <View style={styles.pair}>
                              <View style={styles.half}>
                                <Text style={layout.body}>
                                  Baseline used for this analysis
                                </Text>
                                <EvidenceImage
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
                                <Text style={layout.body}>
                                  Current photo used for this analysis
                                </Text>
                                <EvidenceImage
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
                              {c.result.findings.map(
                                (finding, findingIndex) => {
                                  const status =
                                    c.finding_decisions?.[findingIndex] ??
                                    c.decision;
                                  return (
                                    <View
                                      key={findingIndex}
                                      style={styles.card}
                                    >
                                      <Text style={layout.body}>
                                        {finding.description} ·{' '}
                                        {finding.classification}
                                      </Text>
                                      <Text style={layout.body}>
                                        Finding decision:{' '}
                                        {status || 'Awaiting review'}
                                      </Text>
                                      {(record.status === 'submitted' ||
                                        status === 'confirmed') &&
                                        (record.status === 'submitted'
                                          ? [
                                              'confirmed',
                                              'dismissed',
                                              'manual-review',
                                              ...(status === 'confirmed'
                                                ? ['resolved']
                                                : []),
                                            ]
                                          : ['resolved']
                                        ).map(decision => (
                                          <Button
                                            key={decision}
                                            variant="outline"
                                            title={`Finding ${
                                              findingIndex + 1
                                            }: ${decision}`}
                                            disabled={busy}
                                            onPress={() =>
                                              action('decision', {
                                                comparison_id: c.id,
                                                finding_index: findingIndex,
                                                decision,
                                              })
                                            }
                                          />
                                        ))}
                                    </View>
                                  );
                                },
                              )}
                            </>
                          )}
                          <Text style={layout.body}>
                            Pair decision:{' '}
                            {c.decision ||
                              (c.finding_decisions?.every(d => d) &&
                              c.finding_decisions.length
                                ? 'See individual finding decisions'
                                : 'Awaiting review')}
                          </Text>
                          {c.decision === 'confirmed' &&
                            c.status === 'completed' && (
                              <Button
                                title="Mark resolved"
                                disabled={busy}
                                onPress={() =>
                                  action('decision', {
                                    comparison_id: c.id,
                                    decision: 'resolved',
                                  })
                                }
                              />
                            )}
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
                                    variant="outline"
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
                                      style={layout.input}
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
                      <Text style={layout.body}>
                        {c.result?.summary || 'Analysis pending'} ·{' '}
                        {c.decision || 'Awaiting human review'}
                      </Text>
                      {c.baseline_photo_id && c.current_photo_id && (
                        <View style={styles.pair}>
                          <View style={styles.half}>
                            <Text style={layout.body}>Baseline used</Text>
                            <EvidenceImage
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
                            <Text style={layout.body}>Previous evidence</Text>
                            <EvidenceImage
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
                      onPress={() => {
                        if (
                          record.active_baseline_id &&
                          record.baseline_source_id !== record.id
                        )
                          Alert.alert(
                            'Supersede approved baseline?',
                            'The previous baseline and all historical analyses will be preserved.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Supersede and approve',
                                onPress: () =>
                                  action('approve-baseline', {
                                    supersedes: record.active_baseline_id,
                                  }),
                              },
                            ],
                          );
                        else action('approve-baseline');
                      }}
                    />
                  )}
                {record.status === 'submitted' && (
                  <>
                    <TextInput
                      style={layout.input}
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
  root: { flex: 1, backgroundColor: colors.background },
  title: { ...layout.sectionTitle },
  card: { ...layout.card },
  assessment: { ...layout.notice },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { flexGrow: 1, flexBasis: 140, minWidth: 0, gap: 8 },
  photo: { width: '100%', aspectRatio: 1, resizeMode: 'contain' },
});
