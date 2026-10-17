
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    color: '#1769B0',
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
  const [todayNotifications, setTodayNotifications] = useState(
    initialTodayNotifications,
  );

  const [earlierNotifications, setEarlierNotifications] = useState(
    initialEarlierNotifications,
  );

  const markAllAsRead = () => {
    setTodayNotifications((notifications) =>
      notifications.map((notification) => ({
        ...notification,
        unread: false,
      })),
    );

    setEarlierNotifications((notifications) =>
      notifications.map((notification) => ({
        ...notification,
        unread: false,
      })),
    );
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      style={styles.notificationCard}
      activeOpacity={0.8}
    >
      <View style={styles.notificationHeader}>
        <View
          style={[
            styles.severityDot,
            { backgroundColor: notification.color },
          ]}
        />

        <Text style={styles.notificationTitle}>
          {notification.title}
        </Text>

        {notification.unread && <View style={styles.unreadDot} />}
      </View>

      <Text style={styles.notificationMessage}>
        {notification.message}
      </Text>

      <Text style={styles.notificationTime}>
        {notification.time}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Notifications</Text>

          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
            activeOpacity={0.7}
          >
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Today</Text>

        <View>{todayNotifications.map(renderNotification)}</View>

        <Text style={[styles.sectionTitle, styles.earlierTitle]}>
          Earlier
        </Text>

        <View>{earlierNotifications.map(renderNotification)}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },

  container: {
    flex: 1,
    backgroundColor: '#F4F8FC',
  },

  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 16,
  },

  backButton: {
    width: 28,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  backArrow: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
    color: '#172235',
  },

  headerTitle: {
    flex: 1,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#172235',
    marginLeft: 2,
  },

  markAllButton: {
    paddingLeft: 4,
    paddingVertical: 6,
  },

  markAllText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#1769B0',
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#5B6B82',
    marginBottom: 12,
  },

  earlierTitle: {
    marginTop: 18,
  },

  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,
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
    color: '#172235',
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1769B0',
    marginLeft: 8,
  },

  notificationMessage: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    color: '#5B6B82',
    marginTop: 12,
    marginLeft: 20,
  },

  notificationTime: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: '#8290A3',
    marginTop: 16,
    marginLeft: 20,
  },
});
