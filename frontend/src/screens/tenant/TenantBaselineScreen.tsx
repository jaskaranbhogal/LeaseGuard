import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import PhotoTile from '../../components/PhotoTile';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  getApprovedBaseline,
  approvedBaselinePhotoUrl,
  type ApprovedBaseline,
} from '../../services/baselineService';
import EvidenceNotes from '../../components/EvidenceNotes';
import type { TenantStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';
import StateCard from '../../components/StateCard';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantBaseline'>;

export default function TenantBaselineScreen({ navigation, route }: Props) {
  const [baseline, setBaseline] = useState<ApprovedBaseline | null>();
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setBaseline(await getApprovedBaseline(route.params.unitId));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [route.params.unitId]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Move-in baseline"
        subtitle={
          baseline ? `${baseline.property} · Unit ${baseline.unit}` : undefined
        }
        onBack={() => navigation.goBack()}
      />
      {!!error && (
        <Text style={layout.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <ActionButton
        title="Refresh baseline"
        variant="secondary"
        onPress={refresh}
      />
      {baseline === undefined && !error && (
        <StateCard title="Loading approved baseline…" loading />
      )}
      {baseline === null && (
        <StateCard
          title="No approved baseline yet"
          message="Your landlord can create one or assign a move-in inspection. Approved photos will appear here."
        />
      )}
      {baseline && (
        <>
          <Text style={styles.intro}>
            Approved {new Date(baseline.approved_at).toLocaleString()} · Layout
            version {baseline.template_version}. These photos remain unchanged
            when you submit new inspection evidence.
          </Text>
          <View style={styles.grid}>
            {baseline.photos.map(p => (
              <View key={p.id} style={styles.photoWithNotes}>
                <PhotoTile
                  area={p.room}
                  uri={approvedBaselinePhotoUrl(
                    baseline.unit_id,
                    baseline.id,
                    p.id,
                  )}
                  placeholder="BASELINE"
                />
                <EvidenceNotes notes={p.notes} />
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              See something that is not shown?
            </Text>
            <Text style={styles.cardBody}>
              Ask your landlord to assign a move-in inspection to record your
              observations. Your submitted evidence remains separate until an
              authorized manager approves a baseline version.
            </Text>
          </View>
          <ActionButton
            title="Open assigned inspections"
            onPress={() => navigation.navigate('GuidedInspection')}
          />
        </>
      )}
      <ActionButton
        title="Back to dashboard"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  photoWithNotes: { width: '100%', gap: 8 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  intro: { fontSize: 14, lineHeight: 20, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    gap: 4,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  cardBody: { fontSize: 13, lineHeight: 19, color: colors.muted },
});
