import { colors } from '../../theme/colors';
import DemoNotice from '../../components/DemoNotice';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TenantTabParamList } from '../../navigation/types';
import type { TenantStackParamList } from '../../navigation/types';
import {
  unitHistoryMockData,
  type HistoryEntryType,
} from '../../data/unitHistoryMockData';

const COLORS = {
  background: colors.background,
  white: colors.white,
  primary: '#1459EB',
  primaryLight: '#EBF2FF',
  text: '#131824',
  muted: '#5E6B80',
  border: '#D6DEEB',
  green: '#14874A',
  greenLight: '#E5FAF0',
  orange: '#E58212',
  orangeLight: '#FFF2DE',
  purple: '#6B45D1',
  purpleLight: '#F2EBFF',
  red: '#D12E33',
};

const BADGE_COLORS = {
  'move-in': {
    background: COLORS.primaryLight,
    text: COLORS.primary,
    width: 70,
  },
  inspection: {
    background: COLORS.greenLight,
    text: COLORS.green,
    width: 82,
  },
  maintenance: {
    background: COLORS.orangeLight,
    text: COLORS.orange,
    width: 98,
  },
};

export default function UnitHistoryScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<TenantTabParamList>>();

  const stackNavigation =
    navigation.getParent<NativeStackNavigationProp<TenantStackParamList>>();
  const { title, subtitle, entries, comparison } = unitHistoryMockData;

  function getStatusColor(type: HistoryEntryType) {
    return type === 'inspection' ? COLORS.red : COLORS.orange;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        <DemoNotice />

        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.historyList}>
          {entries.map(entry => {
            const badgeColors = BADGE_COLORS[entry.type];
            const isMaintenance = entry.type === 'maintenance';

            return (
              <Pressable
                key={entry.id}
                style={styles.historyCard}
                disabled={!isMaintenance}
                accessibilityRole={isMaintenance ? 'button' : undefined}
                onPress={() => {
                  if (entry.type === 'maintenance') {
                    stackNavigation?.navigate('MaintenanceDetail', {
                      requestId: entry.requestId,
                    });
                  }
                }}
              >
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: badgeColors.background,
                      width: badgeColors.width,
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: badgeColors.text }]}>
                    {entry.badge}
                  </Text>
                </View>

                <View style={styles.historyDetails}>
                  <Text style={styles.historyTitle}>{entry.title}</Text>

                  <Text style={styles.historySubtitle}>{entry.details}</Text>

                  {entry.status ? (
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(entry.type) },
                      ]}
                    >
                      {entry.status}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>{comparison.title}</Text>

          <Text style={styles.comparisonDescription}>
            {comparison.description}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>Back to dashboard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 32,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 8,
  },
  historyList: {
    gap: 16,
    marginTop: 30,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badge: {
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyDetails: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  historySubtitle: {
    fontSize: 12,
    color: COLORS.muted,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  comparisonCard: {
    backgroundColor: COLORS.purpleLight,
    borderColor: COLORS.purple,
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 106,
    padding: 16,
    marginTop: 16,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.purple,
  },
  comparisonDescription: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
    marginTop: 12,
  },
  backButton: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
