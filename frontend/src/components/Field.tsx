import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function Field({
  label,
  hint,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        autoCorrect={false}
        {...props}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          error ? styles.invalid : undefined,
          style,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: 13,
    fontWeight: typography.medium,
    color: colors.muted,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  focused: { borderColor: colors.brand, borderWidth: 1.5 },
  invalid: { borderColor: colors.error },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 2 },
  error: { fontSize: 12, lineHeight: 17, color: colors.error, marginTop: 2 },
});
