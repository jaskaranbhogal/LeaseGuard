import { Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type PropertyStatus = 'review' | 'clear';

interface PropertySummary {
  id: string;
  name: string;
  location: string;
  unitCount: number;
  status: PropertyStatus;
  statusLabel: string;
  headline: string;
  detail: string;
  tag?: string;
}

interface Props {
  onBellPress?: () => void;
  onReviewPress?: () => void;
  onAddProperty?: () => void;
  onPropertyPress?: (propertyId: string) => void;
  onScheduleInspection?: () => void;
  onManageUnits?: () => void;
}

const landlordName = 'Marcus';
const reviewCount = 2;
const highSeverityCount = 1;

const properties: PropertySummary[] = [
  {
    id: 'cedar-ave',
    name: '18 Cedar Ave',
    location: 'Farmingdale, NY',
    unitCount: 2,
    status: 'review',
    statusLabel: '2 to review',
    headline: 'Unit 1A • Alyssa Patel',
    detail: 'Inspection submitted',
    tag: 'HIGH',
  },
  {
    id: 'maple-st',
    name: '44 Maple St',
    location: 'Hicksville, NY',
    unitCount: 2,
    status: 'clear',
    statusLabel: 'All clear',
    headline: 'Next inspection: Oct 15',
    detail: 'No open maintenance requests',
  },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default function LandlordDashboardScreen({
  onBellPress,
  onReviewPress,
  onAddProperty,
  onPropertyPress,
  onScheduleInspection,
  onManageUnits,
}: Props) {
  const totalUnits = properties.reduce((sum, p) => sum + p.unitCount, 0);
  const findingLabel =
    highSeverityCount === 1
      ? '1 high-severity inspection finding'
      : `${highSeverityCount} high-severity inspection findings`;

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            {greeting()}, {landlordName}
          </Text>
          <Text style={styles.subtitle}>
            {totalUnits} units across {properties.length} properties
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={12}
          onPress={onBellPress}
        >
          <Text style={styles.bell}>🔔</Text>
        </Pressable>
      </View>

      {reviewCount > 0 && (
        <Card onPress={onReviewPress} style={styles.banner}>
          <View style={styles.alertBadge}>
            <Text style={styles.alertMark}>!</Text>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>
              {reviewCount} items need review
            </Text>
            {highSeverityCount > 0 && (
              <Text style={styles.bannerSubtitle}>{findingLabel}</Text>
            )}
          </View>
        </Card>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Properties</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onAddProperty}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Text style={styles.addButtonText}>+ Add property</Text>
        </Pressable>
      </View>

      {properties.map(property => (
        <Card
          key={property.id}
          onPress={() => onPropertyPress?.(property.id)}
          style={styles.propertyCard}
        >
          <View style={styles.propertyHeader}>
            <View style={styles.propertyTitle}>
              <Text style={styles.propertyName}>{property.name}</Text>
              <Text style={styles.propertyMeta}>
                {property.location} • {property.unitCount} units
              </Text>
            </View>
            <View
              style={[
                styles.pill,
                property.status === 'review' ? styles.pillError : styles.pillOk,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  property.status === 'review'
                    ? styles.pillTextError
                    : styles.pillTextOk,
                ]}
              >
                {property.statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.propertyFooter}>
            <View style={styles.propertyTitle}>
              <Text style={styles.headline}>{property.headline}</Text>
              <Text style={styles.detail}>{property.detail}</Text>
            </View>
            {property.tag && (
              <View style={[styles.pill, styles.pillError]}>
                <Text style={[styles.pillText, styles.pillTextError]}>
                  {property.tag}
                </Text>
              </View>
            )}
          </View>
        </Card>
      ))}

      <View style={styles.actions}>
        <Button
          title="Schedule inspection"
          variant="reset"
          onPress={() => onScheduleInspection?.()}
        />
        <Button
          title="Manage unit details"
          variant="outline"
          onPress={() => onManageUnits?.()}
        />
      </View>
    </ScreenContainer>
  );
}

const tints = {
  error: '#FDECEC',
  success: '#E4F6EB',
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  greeting: {
    fontSize: 26,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bell: { fontSize: 24 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 20,
  },
  alertBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tints.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertMark: {
    fontSize: 18,
    fontWeight: typography.bold,
    color: colors.error,
  },
  bannerText: { flex: 1, gap: spacing.xs },
  bannerTitle: {
    fontSize: 17,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: colors.error,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  addButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.actionBlue,
  },
  pressed: { opacity: 0.7 },
  propertyCard: { paddingVertical: 20 },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  propertyTitle: { flex: 1, gap: spacing.xs },
  propertyName: {
    fontSize: 18,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  propertyMeta: { fontSize: 14, color: colors.textSecondary },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  propertyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headline: {
    fontSize: 15,
    fontWeight: typography.medium,
    color: colors.text,
  },
  detail: { fontSize: 14, color: colors.textSecondary },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  pillError: { backgroundColor: tints.error },
  pillOk: { backgroundColor: tints.success },
  pillText: { fontSize: 13, fontWeight: typography.semibold },
  pillTextError: { color: colors.error },
  pillTextOk: { color: colors.success },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
