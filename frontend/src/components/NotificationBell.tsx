import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type NotificationBellProps = {
  unreadCount?: number;
  onPress: () => void;
};

export default function NotificationBell({
  unreadCount = 0,
  onPress,
}: NotificationBellProps) {
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
      onPress={onPress}
      style={styles.container}
      hitSlop={10}
    >
      <View style={styles.iconWrapper}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 17H9M15 17H20L18.6 15.6C18.22 15.22 18 14.7 18 14.16V11C18 8.24 16.21 5.9 13.75 5.08V4.5C13.75 3.53 12.97 2.75 12 2.75C11.03 2.75 10.25 3.53 10.25 4.5V5.08C7.79 5.9 6 8.24 6 11V14.16C6 14.7 5.78 15.22 5.4 15.6L4 17H9M15 17V17.5C15 19.16 13.66 20.5 12 20.5C10.34 20.5 9 19.16 9 17.5V17"
            stroke="#131824"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>

        {hasUnread && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: '#E5484D',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
