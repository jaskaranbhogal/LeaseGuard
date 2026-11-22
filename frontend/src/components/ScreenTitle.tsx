import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export default function ScreenTitle({ title, subtitle, onBack, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={[styles.titleRow, onBack && styles.withBack]}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              hitSlop={8}
              style={styles.back}
            >
              <Icon name="back" size={22} />
            </Pressable>
          ) : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        {right}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  withBack: { marginLeft: -12 },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  subtitle: { fontSize: 13, color: colors.muted },
});
