import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const suggestions = [
  'Entry door',
  'Bedroom window',
  'Closet',
  'Stove',
  'Fridge',
  'Hallway floor',
];

type Props = {
  visible: boolean;
  tenantName: string;
  existing: string[];
  onAdd: (name: string) => void;
  onClose: () => void;
};

export default function AddAreaSheet({
  visible,
  tenantName,
  existing,
  onAdd,
  onClose,
}: Props) {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setSubmitted(false);
    }
  }, [visible]);

  const trimmed = name.trim();
  const duplicate = existing.some(
    area => area.toLowerCase() === trimmed.toLowerCase(),
  );
  const error = !trimmed
    ? 'Enter an area name.'
    : duplicate
    ? 'This unit already has that area.'
    : undefined;

  function add() {
    setSubmitted(true);
    if (error) return;
    onAdd(trimmed);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              Add area
            </Text>
            <Text style={styles.subtitle}>
              Be specific so {tenantName} knows exactly what to photograph.
            </Text>
          </View>
          <Field
            label="Area name"
            placeholder="Entry door"
            value={name}
            onChangeText={setName}
            error={submitted ? error : undefined}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <View style={styles.suggestions}>
            <Text style={styles.label}>Suggestions</Text>
            <View style={styles.chips}>
              {suggestions.map(suggestion => {
                const selected = suggestion === trimmed;
                return (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setName(suggestion)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {suggestion}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.warning}>
            This area has no baseline yet. Record one before the next inspection
            that includes it.
          </Text>
          <ActionButton title="Add area" onPress={add} />
          <ActionButton title="Cancel" variant="link" onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.white,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
  },
  heading: { gap: 4 },
  title: { fontSize: 22, fontWeight: typography.bold, color: colors.ink },
  subtitle: { fontSize: 13, lineHeight: 18, color: colors.muted },
  suggestions: { gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: typography.medium,
    color: colors.muted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  chipSelected: {
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  chipText: { fontSize: 13, fontWeight: typography.medium, color: colors.ink },
  chipTextSelected: { fontWeight: typography.semibold, color: colors.brand },
  warning: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.warnBg,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warnText,
  },
});
