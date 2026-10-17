import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface Props {
  label: string;
  onPress?: () => void;
}

export default function UnitChip({ label, onPress }: Props) {
  if (!onPress) {
    return (
      <View style={styles.chip} accessible accessibilityLabel={label}>
        <Text style={styles.label}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change unit, ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.chevron}>⌄</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chevron: { fontSize: 16, color: colors.text, marginTop: -4 },
  label: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.text,
  },
  pressed: { opacity: 0.7 },
});
