import DemoNotice from '../../components/DemoNotice';
import Header from '../../components/Header';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import type {
  LandlordStackParamList,
  LandlordTabParamList,
} from '../../navigation/types';
import UnitChip from '../../components/UnitChip';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = CompositeScreenProps<
  NativeStackScreenProps<LandlordStackParamList, 'AIInspectionReview'>,
  BottomTabScreenProps<LandlordTabParamList, 'HomeStack'>
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
      <Header
        onBack={() => navigation.goBack()}
        title="Inspection results"
        style={styles.header}
      >
        <UnitChip label={unitLabel} />
      </Header>

      <DemoNotice />
      <View style={styles.status}>
        <Text style={styles.statusText}>
          Sample AI comparison — no analysis performed
        </Text>
      </View>

      <Card style={styles.areaCard}>
        <Text style={styles.areaTitle}>{area}</Text>
        <View style={styles.photos}>
          <View style={[styles.photo, styles.photoBaseline]}>
            <Text style={styles.photoLabel}>PLACEHOLDER{'\n'}BASELINE</Text>
          </View>
          <View style={[styles.photo, styles.photoCurrent]}>
            <Text style={styles.photoLabel}>PLACEHOLDER{'\n'}CURRENT</Text>
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
          Example AI output only. These are sample findings, not an analysis of
          your property.
        </Text>
      </Card>

      <View style={styles.decisions}>
        <Button
          title="Confirm damage"
          onPress={() =>
            Alert.alert(
              'Damage confirmation preview',
              'Demo only. No decision was saved or sent.',
            )
          }
          style={[styles.decision, styles.confirm]}
        />
        <Button
          title="Dismiss"
          variant="outline"
          onPress={() =>
            Alert.alert(
              'Dismissal preview',
              'Demo only. No decision was saved or sent.',
            )
          }
          style={styles.decision}
        />
        <Button
          title="Resolved"
          variant="outline"
          onPress={() =>
            Alert.alert(
              'Resolution preview',
              'Demo only. No decision was saved or sent.',
            )
          }
          style={styles.decision}
        />
      </View>
      <Button
        title="Open unit history"
        variant="outline"
        onPress={() => navigation.navigate('History')}
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
  decisions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  decision: { flexGrow: 1, flexBasis: 100, paddingHorizontal: 8 },
  confirm: { backgroundColor: colors.error },
});
