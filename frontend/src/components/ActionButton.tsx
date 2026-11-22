import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Variant = 'primary' | 'secondary' | 'dangerOutline' | 'danger' | 'link';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  compact?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ActionButton({
  title,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          compact && styles.compactLabel,
          labelStyles[variant],
          disabled && styles.disabledLabel,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  compact: { height: 44, borderRadius: 12 },
  primary: { backgroundColor: colors.brand },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dangerOutline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#F3C7C2',
  },
  danger: { height: 44, backgroundColor: 'transparent' },
  link: { height: 44, backgroundColor: 'transparent' },
  disabled: { backgroundColor: colors.disabledBg, borderWidth: 0 },
  pressed: { opacity: 0.8 },
  label: { fontSize: 15, fontWeight: typography.semibold },
  compactLabel: { fontSize: 14 },
  disabledLabel: { color: colors.disabledText },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.brand },
  dangerOutline: { color: colors.error },
  danger: { color: colors.error, fontSize: 14 },
  link: { color: colors.brand, fontSize: 14 },
});
