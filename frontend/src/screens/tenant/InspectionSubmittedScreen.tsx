import { colors } from '../../theme/colors';
import React from 'react';
import { useInspection } from '../../context/InspectionContext';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { TenantStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'InspectionSubmitted'
>;

const COLORS = {
  background: colors.background,
  blue: '#1459EB',
  white: colors.white,
  green: '#14874A',
  muted: '#5E6B80',
};

export default function InspectionSubmittedScreen({ navigation }: Props) {
  const { acceptedCount, complete } = useInspection();
  function backToDashboard() {
    navigation.popTo('TenantTabs', { screen: 'Home' });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.successHero}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>

          <Text style={styles.title}>
            {complete
              ? 'Inspection demo complete'
              : 'Inspection demo incomplete'}
          </Text>

          <Text style={styles.subtitle}>
            No photos were captured, analyzed, saved, or submitted. No landlord
            was notified.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={styles.dashboardButton}
            onPress={backToDashboard}
          >
            <Text style={styles.dashboardButtonText}>Back to dashboard</Text>
          </Pressable>

          <Text style={styles.summary}>
            {acceptedCount} placeholder areas reviewed · Demo only
          </Text>
        </View>
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
    backgroundColor: COLORS.background,
  },
  successHero: {
    minHeight: 330,
    paddingBottom: 24,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 76,
  },
  checkCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 50,
    fontWeight: '700',
    color: COLORS.green,
    textAlign: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 314,
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 55,
    alignItems: 'center',
  },
  dashboardButton: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  summary: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
  },
});
