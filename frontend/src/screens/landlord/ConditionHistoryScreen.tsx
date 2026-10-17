import DemoNotice from '../../components/DemoNotice';
import Header from '../../components/Header';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import UnitChip from '../../components/UnitChip';
import type { LandlordTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = BottomTabScreenProps<LandlordTabParamList, 'History'>;

const unitLabel = '18 Cedar Ave • Unit 1A';

const baseline = {
  title: 'Move-in condition recorded',
  meta: 'Jun 1, 2026 • 14 photos',
};

const inspection = {
  title: 'Routine inspection',
  meta: 'Sep 22, 2026 • 4 areas',
  findings: 1,
};

const maintenance = {
  title: 'Kitchen sink leak',
  meta: 'Reported Sep 21 • Plumber scheduled Sep 25',
};

export default function ConditionHistoryScreen({ navigation }: Props) {
  return (
    <ScreenContainer style={styles.content}>
      <Header title="Condition history" style={styles.header}>
        <UnitChip label={unitLabel} />
      </Header>

      <DemoNotice />
      <Card style={styles.eventCard}>
        <View style={[styles.pill, styles.pillBaseline]}>
          <Text style={[styles.pillText, styles.pillTextBaseline]}>
            BASELINE
          </Text>
        </View>
        <View style={styles.eventBody}>
          <Text style={styles.eventTitle}>{baseline.title}</Text>
          <Text style={styles.meta}>{baseline.meta}</Text>
        </View>
      </Card>

      <Card style={styles.eventCard}>
        <View style={[styles.pill, styles.pillInspection]}>
          <Text style={[styles.pillText, styles.pillTextInspection]}>
            INSPECTION
          </Text>
        </View>
        <View style={styles.eventBody}>
          <Text style={styles.eventTitle}>{inspection.title}</Text>
          <Text style={styles.meta}>{inspection.meta}</Text>
          <View style={[styles.pill, styles.pillFinding]}>
            <Text style={[styles.pillText, styles.pillTextFinding]}>
              {inspection.findings} confirmed finding
              {inspection.findings === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Maintenance history</Text>

      <Card style={styles.maintenanceCard}>
        <View style={[styles.pill, styles.pillProgress]}>
          <Text style={[styles.pillText, styles.pillTextProgress]}>
            IN PROGRESS
          </Text>
        </View>
        <Text style={styles.eventTitle}>{maintenance.title}</Text>
        <Text style={styles.meta}>{maintenance.meta}</Text>
      </Card>

      <View style={styles.comparison}>
        <Text style={styles.comparisonTitle}>
          Move-in ↔ Move-out comparison
        </Text>
        <Text style={styles.comparisonText}>
          Available after the move-out inspection is completed.
        </Text>
        <Text style={styles.comparisonText}>
          Keeps the final condition record clear for both parties.
        </Text>
      </View>

      <Button
        title="Back to dashboard"
        variant="outline"
        onPress={() =>
          navigation.navigate('HomeStack', { screen: 'Dashboard' })
        }
      />
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
  eventCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 20,
  },
  eventBody: { flex: 1, gap: spacing.sm },
  eventTitle: {
    fontSize: 18,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  meta: { fontSize: 15, lineHeight: 21, color: colors.textSecondary },
  sectionTitle: {
    fontSize: 20,
    fontWeight: typography.bold,
    color: colors.headerNavy,
    marginTop: spacing.sm,
  },
  maintenanceCard: { gap: spacing.sm, paddingVertical: 20 },
  pill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  pillText: { fontSize: 13, fontWeight: typography.semibold },
  pillBaseline: { backgroundColor: '#EAF1FE' },
  pillTextBaseline: { color: colors.actionBlue },
  pillInspection: { backgroundColor: '#E4F6EB' },
  pillTextInspection: { color: colors.success },
  pillFinding: { backgroundColor: '#FDECEC' },
  pillTextFinding: { color: colors.error },
  pillProgress: { backgroundColor: '#FDF0DC' },
  pillTextProgress: { color: '#D97706' },
  comparison: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7C4DDB',
    backgroundColor: '#F1EAFE',
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: typography.semibold,
    color: '#6D3FD6',
  },
  comparisonText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
