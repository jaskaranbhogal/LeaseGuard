import Header from '../../components/Header';
import { colors } from '../../theme/colors';
import DemoNotice from '../../components/DemoNotice';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useInspection } from '../../context/InspectionContext';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { TenantTabParamList } from '../../navigation/types';
import type { TenantStackParamList } from '../../navigation/types';

import { tenantMockData } from '../../data/tenantMockData';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TenantTabParamList, 'Home'>,
  NativeStackScreenProps<TenantStackParamList>
>;

const COLORS = {
  background: colors.background,
  white: colors.white,
  primary: '#1459EB',
  primaryLight: '#EBF2FF',
  text: '#131824',
  muted: '#5E6B80',
  border: '#D6DEEB',
  orange: '#E58212',
  orangeLight: '#FFF2DE',
  purple: '#6B45D1',
  purpleLight: '#F2EBFF',
};

export default function TenantDashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const demo = useInspection();
  const { tenant, inspection, recentMaintenance } = tenantMockData;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Tenant information */}
          <Header
            title={`Hi, ${user?.name || user?.email || ''}`}
            subtitle={`${tenant.propertyAddress} • Unit ${tenant.unitNumber}`}
            titleStyle={styles.greeting}
            subtitleStyle={styles.property}
            style={styles.header}
            unreadCount={tenantMockData.notifications.unreadCount}
            onNotificationsPress={() => navigation.navigate('Notifications')}
          />

          <DemoNotice />
          {/* Upcoming inspection */}
          {inspection ? (
            <View style={styles.inspectionCard}>
              <View style={styles.dueBadge}>
                <Text style={styles.dueText}>
                  DUE {inspection.dueDate.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.inspectionTitle}>{inspection.title}</Text>

              <Text style={styles.inspectionSubtitle}>
                {inspection.requiredAreas} required areas • about{' '}
                {inspection.estimatedMinutes} minutes
              </Text>

              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => {
                  if (demo.complete) {
                    demo.restart();
                  }
                  navigation.navigate('GuidedInspection');
                }}
              >
                <Text style={styles.primaryButtonText}>
                  {demo.complete
                    ? 'Start another demo'
                    : demo.acceptedCount
                    ? 'Resume inspection demo'
                    : 'Start inspection demo'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No upcoming inspections</Text>

              <Text style={styles.mutedText}>
                Your scheduled inspections will appear here.
              </Text>
            </View>
          )}

          {/* Quick actions */}
          <Text style={styles.sectionTitle}>Quick actions</Text>

          <View style={styles.quickActions}>
            <Pressable
              accessibilityRole="button"
              style={styles.quickCard}
              onPress={() => navigation.navigate('ReportMaintenance')}
            >
              <View style={[styles.actionIcon, styles.orangeIcon]}>
                <Text style={styles.orangeIconText}>!</Text>
              </View>

              <Text style={styles.quickTitle}>Report issue</Text>

              <Text style={styles.quickSubtitle}>Demo form</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.quickCard}
              onPress={() => navigation.navigate('InspectionAvailability')}
            >
              <View style={[styles.actionIcon, styles.purpleIcon]}>
                <Text style={styles.purpleIconText}>A</Text>
              </View>

              <Text style={styles.quickTitle}>Availability</Text>

              <Text style={styles.quickSubtitle}>For in-person visit</Text>
            </Pressable>
          </View>

          {/* Recent activity */}
          <Text style={styles.sectionTitle}>Recent activity</Text>

          {recentMaintenance ? (
            <Pressable
              accessibilityRole="button"
              style={styles.activityCard}
              onPress={() =>
                navigation.navigate('MaintenanceDetail', {
                  requestId: recentMaintenance.requestId,
                })
              }
            >
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {recentMaintenance.status.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.activityTitle}>
                {recentMaintenance.title}
              </Text>

              <Text style={styles.activityDescription}>
                {recentMaintenance.update}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.mutedText}>
                No recent maintenance activity.
              </Text>
            </View>
          )}

          {/* View unit history */}
          <Pressable
            accessibilityRole="button"
            style={styles.historyButton}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.historyButtonText}>View unit history</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  header: { marginBottom: 28 },
  greeting: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: '700',
  },

  property: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 5,
  },

  inspectionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    marginBottom: 26,
  },

  dueBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 13,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 11,
  },

  dueText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },

  inspectionTitle: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 6,
  },

  inspectionSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 14,
  },

  primaryButton: {
    minHeight: 36,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 14,
  },

  quickActions: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },

  quickCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    minHeight: 110,
  },

  actionIcon: {
    height: 36,
    width: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  orangeIcon: {
    backgroundColor: COLORS.orangeLight,
  },

  orangeIconText: {
    color: COLORS.orange,
    fontSize: 16,
    fontWeight: '700',
  },

  purpleIcon: {
    backgroundColor: COLORS.purpleLight,
  },

  purpleIconText: {
    color: COLORS.purple,
    fontSize: 13,
    fontWeight: '700',
  },

  quickTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  quickSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 5,
  },

  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 28,
  },

  statusBadge: {
    backgroundColor: COLORS.orangeLight,
    borderRadius: 13,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },

  statusText: {
    fontSize: 11,
    color: COLORS.orange,
    fontWeight: '600',
  },

  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },

  activityDescription: {
    fontSize: 12,
    color: COLORS.muted,
  },

  historyButton: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginBottom: 26,
  },

  emptyTitle: {
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 4,
  },

  mutedText: {
    color: COLORS.muted,
    fontSize: 12,
  },
});
