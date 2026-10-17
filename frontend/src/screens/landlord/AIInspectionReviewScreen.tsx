import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import type { LandlordStackParamList } from '../../navigation/types';
import UnitChip from '../../components/UnitChip';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<
  LandlordStackParamList,
  'AIInspectionReview'
>;

const unitLabel = '18 Cedar Ave • Unit 1A';
const area = 'Bathroom ceiling';
const observation = 'Visible discoloration near ceiling corner';
const severity = 'HIGH SEVERITY';
const category = 'Potential damage';
const finding = 'Possible moisture / water staining detected.';

export default function AIInspectionReviewScreen({ navigation }: Props) {
  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Inspection results</Text>
        <UnitChip label={unitLabel} />
      </View>

      <View style={styles.status}>
        <Text style={styles.statusText}>AI comparison complete</Text>
      </View>

      <Card style={styles.areaCard}>
        <Text style={styles.areaTitle}>{area}</Text>
        <View style={styles.photos}>
          <View style={[styles.photo, styles.photoBaseline]}>
            <Text style={styles.photoLabel}>MOVE-IN{'\n'}BASELINE</Text>
          </View>
          <View style={[styles.photo, styles.photoCurrent]}>
            <Text style={styles.photoLabel}>CURRENT{'\n'}INSPECTION</Text>
          </View>
        </View>
        <Text style={styles.observation}>{observation}</Text>
      </Card>

      <Card style={styles.findingCard}>
        <View style={styles.tags}>
          <View style={[styles.pill, styles.pillError]}>
            <Text style={[styles.pillText, styles.pillTextError]}>
              {severity}
            </Text>
          </View>
          <View style={[styles.pill, styles.pillWarning]}>
            <Text style={[styles.pillText, styles.pillTextWarning]}>
              {category}
            </Text>
          </View>
        </View>
        <Text style={styles.finding}>{finding}</Text>
        <Text style={styles.advisory}>
          AI summary is advisory. You make the final decision.
        </Text>
      </Card>

      <View style={styles.decisions}>
        <Button
          title="Confirm damage"
          onPress={() => navigation.goBack()}
          style={[styles.decision, styles.confirm]}
        />
        <Button
          title="Dismiss"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.decision}
        />
        <Button
          title="Resolved"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.decision}
        />
      </View>
      <Button
        title="Open unit history"
        variant="outline"
        onPress={() => undefined}
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
  header: { gap: spacing.sm },
  title: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  status: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#E4F6EB',
  },
  statusText: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.success,
  },
  areaCard: { gap: spacing.md },
  areaTitle: {
    fontSize: 20,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  photos: { flexDirection: 'row', gap: spacing.md },
  photo: {
    flex: 1,
    height: 112,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBaseline: { backgroundColor: '#E0E7EF' },
  photoCurrent: { backgroundColor: '#CCD6E0' },
  photoLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: typography.bold,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  observation: { fontSize: 16, color: colors.textSecondary },
  findingCard: { gap: spacing.md, paddingVertical: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  pillError: { backgroundColor: '#FDECEC' },
  pillWarning: { backgroundColor: '#FDF0DC' },
  pillText: { fontSize: 14, fontWeight: typography.semibold },
  pillTextError: { color: colors.error },
  pillTextWarning: { color: '#B45309' },
  finding: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: typography.bold,
    color: colors.text,
  },
  advisory: { fontSize: 16, lineHeight: 22, color: colors.textSecondary },
  decisions: { flexDirection: 'row', gap: spacing.sm },
  decision: { flex: 1, paddingHorizontal: 8 },
  confirm: { backgroundColor: colors.error },
});
