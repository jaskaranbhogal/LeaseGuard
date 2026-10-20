import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from './BackButton';
import NotificationBell from './NotificationBell';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onNotificationsPress?: () => void;
  unreadCount?: number;
  rightActions?: ReactNode;
  children?: ReactNode;
  /** Enable only when the parent does not already own the top safe area. */
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export default function Header({
  title,
  subtitle,
  onBack,
  onNotificationsPress,
  unreadCount,
  rightActions,
  children,
  safeArea = false,
  style,
  titleStyle,
  subtitleStyle,
}: Props) {
  const content = (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {onBack ? <BackButton onPress={onBack} /> : null}
        <View style={styles.text}>
          <Text accessibilityRole="header" style={[styles.title, titleStyle]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
          ) : null}
        </View>
        {onNotificationsPress || rightActions ? (
          <View style={styles.actions}>
            {onNotificationsPress ? (
              <NotificationBell
                onPress={onNotificationsPress}
                unreadCount={unreadCount}
              />
            ) : null}
            {rightActions}
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
  return safeArea ? (
    <SafeAreaView edges={['top']}>{content}</SafeAreaView>
  ) : (
    content
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 16,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
});
