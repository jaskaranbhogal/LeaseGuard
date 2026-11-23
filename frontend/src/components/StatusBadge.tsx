import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export default function StatusBadge({ status }: { status: string }) {
  const complete = [
    'reviewed',
    'resolved',
    'approved',
    'active',
    'ready',
    'confirmed',
    'completed',
  ].includes(status);
  const attention = [
    'retake',
    'urgent',
    'overdue',
    'storage_failed',
    'failed',
  ].includes(status);
  return (
    <View
      style={[
        styles.badge,
        complete && styles.complete,
        attention && styles.attention,
      ]}
    >
      <Text
        style={[
          styles.text,
          complete && styles.completeText,
          attention && styles.attentionText,
        ]}
      >
        {status.replace(/[-_]/g, ' ')}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: typography.semibold,
    color: colors.brand,
    textTransform: 'capitalize',
  },
  complete: { backgroundColor: colors.successTint },
  completeText: { color: colors.successText },
  attention: { backgroundColor: colors.warnBg },
  attentionText: { color: colors.warnText },
});
