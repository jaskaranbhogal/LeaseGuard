import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  title: string;
  detail?: string;
  onDismiss: () => void;
};

export default function Toast({ title, detail, onDismiss }: Props) {
  return (
    <View accessibilityRole="alert" style={styles.toast}>
      <View style={styles.check}>
        <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail ? (
          <Text numberOfLines={1} style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: colors.toast,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 10 },
  title: { fontSize: 13, fontWeight: typography.semibold, color: colors.white },
  detail: { fontSize: 12, color: '#CBD5E1' },
  dismiss: { paddingVertical: 14, paddingHorizontal: 8 },
  dismissText: {
    fontSize: 13,
    fontWeight: typography.semibold,
    color: '#A9C2FF',
  },
});
