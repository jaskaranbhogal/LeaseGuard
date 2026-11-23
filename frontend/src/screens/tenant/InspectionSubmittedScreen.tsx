import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import ActionButton from '../../components/ActionButton';
import StateCard from '../../components/StateCard';
import Icon from '../../components/Icon';
import {
  getGuided,
  GuidedInspection,
} from '../../services/guidedInspectionService';
import ScreenContainer from '../../components/ScreenContainer';
import { layout } from '../../theme/layout';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const TYPE_TITLES: Record<string, string> = {
  'move-in': 'Move-in',
  periodic: 'Routine',
  'move-out': 'Move-out',
  'follow-up': 'Follow-up',
};

export default function InspectionSubmittedScreen({
  route,
  navigation,
}: NativeStackScreenProps<TenantStackParamList, 'InspectionSubmitted'>) {
  const [record, setRecord] = useState<GuidedInspection>();
  const [message, setMessage] = useState('Checking server confirmation…');
  useEffect(() => {
    const id = route.params?.inspectionId;
    if (!id) {
      setMessage('Select an inspection to check its status.');
      return;
    }
    getGuided(id)
      .then(r => {
        if (['submitted', 'reviewed'].includes(r.status)) setRecord(r);
        else setMessage('This inspection has not been submitted.');
      })
      .catch(e => setMessage(e.message));
  }, [route.params?.inspectionId]);
  const submittedAt = record?.history
    .filter(h => h.action === 'submit' || h.action === 'submitted')
    .map(h => h.at)
    .pop();
  return (
    <ScreenContainer style={styles.content}>
      {record ? (
        <>
          <View style={styles.check}>
            <Icon name="check" size={34} color={colors.successText} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Inspection submitted
          </Text>
          <Text style={styles.intro}>
            Your landlord can now review your photos and compare them with the
            move-in baseline.
          </Text>
          <View style={[layout.card, styles.card]}>
            <Row
              label="Inspection"
              value={`${TYPE_TITLES[record.inspection_type] || 'Photo'} • ${
                record.unit
              }`}
            />
            <Row
              label="Photos"
              value={`${record.progress} of ${record.required} documented`}
            />
            <Row
              label="Submitted"
              value={new Date(submittedAt || Date.now()).toLocaleDateString(
                undefined,
                { month: 'short', day: 'numeric', year: 'numeric' },
              )}
              last
            />
          </View>
        </>
      ) : (
        <StateCard title={message} loading={message.startsWith('Checking')} />
      )}
      <View style={styles.spacer} />
      <ActionButton
        title="Back to home"
        onPress={() => navigation.popTo('TenantTabs', { screen: 'Home' })}
      />
    </ScreenContainer>
  );
}

function Row({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: 'stretch', paddingTop: 72, gap: 14 },
  check: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: typography.bold,
    color: colors.ink,
  },
  intro: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  card: { paddingVertical: 4, gap: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 12,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.ink,
    textAlign: 'right',
  },
  spacer: { flex: 1, minHeight: 24 },
});
