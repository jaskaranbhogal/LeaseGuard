import Header from '../../components/Header';
import ScreenContainer from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';

import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  color: string;
  unread: boolean;
};

const initialTodayNotifications: Notification[] = [
  {
    id: '1',
    title: 'High-severity change detected',
    message:
      'AI found a significant change in Unit 1A. Review the inspection findings.',
    time: '10 min ago',
    color: '#E34234',
    unread: true,
  },
  {
    id: '2',
    title: 'Maintenance request submitted',
    message: 'A tenant reported a leaking kitchen sink in Unit 1A.',
    time: '1 hr ago',
    color: '#F5A623',
    unread: true,
  },
];

const initialEarlierNotifications: Notification[] = [
  {
    id: '3',
    title: 'Inspection due tomorrow',
    message: 'The routine inspection for Unit 2B is due tomorrow.',
    time: 'Yesterday',
    color: colors.primary,
    unread: true,
  },
  {
    id: '4',
    title: 'Maintenance issue resolved',
    message: 'The bathroom faucet repair for Unit 3C was marked resolved.',
    time: 'Sep 24',
    color: '#27A465',
    unread: false,
  },
];

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [todayNotifications, setTodayNotifications] = useState(
    initialTodayNotifications,
  );

  const [earlierNotifications, setEarlierNotifications] = useState(
    initialEarlierNotifications,
  );

  const markAllAsRead = () => {
    setTodayNotifications(notifications =>
      notifications.map(notification => ({
        ...notification,
        unread: false,
      })),
    );

    setEarlierNotifications(notifications =>
      notifications.map(notification => ({
        ...notification,
        unread: false,
      })),
    );
  };

  const renderNotification = (notification: Notification) => (
    <View
      key={notification.id}
      testID={`notification-${notification.id}`}
      accessible
      accessibilityLabel={`${notification.title}. ${notification.message}. ${notification.time}`}
      accessibilityValue={{ text: notification.unread ? 'Unread' : 'Read' }}
      style={styles.notificationCard}
    >
      <View style={styles.notificationHeader}>
        <View
          style={[styles.severityDot, { backgroundColor: notification.color }]}
        />

        <Text style={styles.notificationTitle}>{notification.title}</Text>

        {notification.unread && <View style={styles.unreadDot} />}
      </View>

      <Text style={styles.notificationMessage}>{notification.message}</Text>

      <Text style={styles.notificationTime}>{notification.time}</Text>
    </View>
  );

  return (
    <ScreenContainer style={styles.contentContainer}>
      <StatusBar barStyle="dark-content" />
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        style={styles.header}
      />

      <Text style={styles.demoNotice}>
        Sample notifications for visual review. Read status is local to this
        screen and resets when reopened; nothing is saved or synchronized with
        Django.
      </Text>
      <View style={styles.todayHeading}>
        <Text style={[styles.sectionTitle, styles.todayTitle]}>Today</Text>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={markAllAsRead}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <View>{todayNotifications.map(renderNotification)}</View>

      <Text style={[styles.sectionTitle, styles.earlierTitle]}>Earlier</Text>

      <View>{earlierNotifications.map(renderNotification)}</View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  demoNotice: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.label,
    marginBottom: 24,
  },
  header: { marginBottom: 24 },

  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },

  todayHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  todayTitle: { marginBottom: 0 },

  markAllButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  markAllText: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.primary,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },

  earlierTitle: {
    marginTop: 18,
  },

  notificationCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 16,
    minHeight: 120,
  },

  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },

  notificationTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.headerNavy,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },

  notificationMessage: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 12,
    marginLeft: 20,
  },

  notificationTime: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 16,
    marginLeft: 20,
  },
});
