import { forwardRef, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

const Input = forwardRef<ComponentRef<typeof TextInput>, Props>(
  function LabeledInput({ label, error, style, ...props }, ref) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          style={[styles.input, error ? styles.invalid : undefined, style]}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

export default Input;
const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { color: colors.label, fontSize: 14 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  invalid: { borderColor: colors.error },
  error: { color: colors.error, fontSize: 13, lineHeight: 18 },
});
