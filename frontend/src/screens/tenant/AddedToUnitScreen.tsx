import { StyleSheet, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useTenantDemo } from '../../context/TenantDemoContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

function rooms(count: string, word: string) {
  return `${count} ${word}${count === '1' ? '' : 's'}`;
}

export default function AddedToUnitScreen() {
  const { user } = useAuth();
  const { unit, finishWelcome } = useTenantDemo();
  const first = user?.name?.trim().split(' ')[0];

  const rows = unit
    ? [
        [
          'Property',
          [unit.street, unit.city.split(',')[0]].filter(Boolean).join(', '),
        ],
        [
          'Unit',
          `${unit.unit} • ${rooms(unit.bedrooms, 'bed')}, ${rooms(
            unit.bathrooms,
            'bath',
          )}`,
        ],
        ['Landlord', unit.landlordName],
      ]
    : [];

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.top}>
        <View style={styles.check}>
          <Icon
            name="check"
            size={36}
            color={colors.successText}
            strokeWidth={2.5}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {first ? `You're all set, ${first}` : "You're all set"}
        </Text>
        <Text style={styles.subtitle}>
          Your account is linked to your unit.
        </Text>
        <View style={styles.card}>
          {rows.map(([label, value], index) => (
            <View
              key={label}
              style={[styles.row, index < rows.length - 1 && styles.divider]}
            >
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>
      </View>
      <ActionButton title="Continue" onPress={finishWelcome} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 32,
    gap: 24,
  },
  top: { alignItems: 'center', gap: 10 },
  check: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
    color: colors.ink,
  },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  card: {
    alignSelf: 'stretch',
    marginTop: 26,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { fontSize: 13, color: colors.muted },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.ink,
  },
});
