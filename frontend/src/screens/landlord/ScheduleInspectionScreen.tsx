import DemoNotice from '../../components/DemoNotice';
import {
  formatLocalDate,
  inspectionDateError,
} from '../../utils/landlordValidation';
import Header from '../../components/Header';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import type { LandlordStackParamList } from '../../navigation/types';
import UnitChip from '../../components/UnitChip';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type InspectionType = 'remote' | 'in-person';

type Props = NativeStackScreenProps<
  LandlordStackParamList,
  'ScheduleInspection'
>;

const unitLabel = '18 Cedar Ave • Unit 1A';
const requiredAreas = [
  'Living room wall',
  'Kitchen sink',
  'Bathroom ceiling',
  'Bedroom floor',
];

const typeOptions: { id: InspectionType; title: string; detail: string }[] = [
  { id: 'remote', title: 'Remote photo', detail: 'Tenant submits media' },
  { id: 'in-person', title: 'In person', detail: 'Request availability' },
];

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatLocalDate(date);
}

export default function ScheduleInspectionScreen({ navigation }: Props) {
  const [type, setType] = useState<InspectionType>('remote');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [areas, setAreas] = useState(requiredAreas);
  const [submitted, setSubmitted] = useState(false);

  const dueDateError = inspectionDateError(dueDate);
  const areasError =
    type === 'remote' && areas.length === 0
      ? 'Pick at least one area.'
      : undefined;

  function toggleArea(area: string) {
    setAreas(current =>
      current.includes(area)
        ? current.filter(item => item !== area)
        : [...current, area],
    );
  }

  function submit() {
    setSubmitted(true);
    if (dueDateError || areasError) {
      return;
    }
    Alert.alert(
      'Demo inspection preview',
      'No inspection was scheduled, no availability request was sent, and no tenant was notified.',
    );
  }

  return (
    <ScreenContainer style={styles.content}>
      <Header title="Schedule inspection" style={styles.header}>
        <UnitChip label={unitLabel} />
      </Header>

      <DemoNotice />
      <View style={styles.section}>
        <Text style={styles.label}>Inspection type</Text>
        <View style={styles.typeRow}>
          {typeOptions.map(option => {
            const selected = option.id === type;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setType(option.id)}
                style={[styles.typeCard, selected && styles.typeCardSelected]}
              >
                <Text
                  style={[styles.typeTitle, selected && styles.typeTitleOn]}
                >
                  {option.title}
                </Text>
                <Text style={styles.typeDetail}>{option.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Input
        label="Due date (YYYY-MM-DD)"
        value={dueDate}
        onChangeText={setDueDate}
        error={submitted ? dueDateError : undefined}
        autoCapitalize="none"
        placeholder="YYYY-MM-DD"
      />

      {type === 'remote' && (
        <View style={styles.section}>
          <Text style={styles.label}>Required areas</Text>
          {requiredAreas.map(area => {
            const selected = areas.includes(area);
            return (
              <Pressable
                key={area}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleArea(area)}
                style={styles.areaRow}
              >
                <View style={[styles.check, selected && styles.checkOn]}>
                  {selected && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.areaText}>{area}</Text>
              </Pressable>
            );
          })}
          {submitted && areasError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {areasError}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title="Preview demo inspection"
          variant="reset"
          onPress={submit}
        />
        <Button
          title="Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </View>
      <Text style={styles.note}>
        Demo preview only. Nothing is scheduled or sent.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  title: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  section: { gap: spacing.sm },
  label: { fontSize: 14, color: colors.label },
  typeRow: { flexDirection: 'row', gap: spacing.md },
  typeCard: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  typeCardSelected: {
    borderColor: colors.actionBlue,
    backgroundColor: '#EAF1FE',
  },
  typeTitle: {
    fontSize: 17,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  typeTitleOn: { color: colors.actionBlue },
  typeDetail: { fontSize: 13, color: colors.textSecondary },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ECEEF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#E4F6EB' },
  checkMark: {
    fontSize: 14,
    fontWeight: typography.bold,
    color: colors.success,
  },
  areaText: {
    fontSize: 17,
    fontWeight: typography.medium,
    color: colors.text,
  },
  error: { fontSize: 13, lineHeight: 18, color: colors.error },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  note: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
