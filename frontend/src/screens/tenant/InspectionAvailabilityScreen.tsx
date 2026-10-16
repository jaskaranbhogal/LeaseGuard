import { colors } from '../../theme/colors';
import DemoNotice from '../../components/DemoNotice';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { inspectionAvailabilityMockData } from '../../data/inspectionAvailabilityMockData';
import type { TenantStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'InspectionAvailability'
>;

const COLORS = {
  background: colors.background,
  white: colors.white,
  primary: '#1459EB',
  primaryLight: '#EBF2FF',
  text: '#131824',
  muted: '#5E6B80',
  border: '#D6DEEB',
  unchecked: '#EBEDF2',
};

export default function InspectionAvailabilityScreen({ navigation }: Props) {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  function toggleSlot(id: string) {
    setSelectedSlots(current =>
      current.includes(id)
        ? current.filter(slot => slot !== id)
        : [...current, id],
    );
  }

  function sendAvailability() {
    if (selectedSlots.length === 0) {
      Alert.alert(
        'Select a time',
        'Please select at least one available time slot.',
      );
      return;
    }

    Alert.alert(
      'Demo availability selected',
      'Demo only. Your selections have not been saved or sent to a landlord.',
      [{ text: 'OK' }],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{inspectionAvailabilityMockData.title}</Text>
        <DemoNotice />

        <Text style={styles.subtitle}>
          {inspectionAvailabilityMockData.description}
        </Text>

        <Text style={styles.instruction}>
          {inspectionAvailabilityMockData.instruction}
        </Text>
        <View style={styles.slots}>
          {inspectionAvailabilityMockData.timeSlots.map(slot => {
            const selected = selectedSlots.includes(slot.id);

            return (
              <Pressable
                key={slot.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${slot.date}, ${slot.time}`}
                onPress={() => toggleSlot(slot.id)}
                style={[styles.slotCard, selected && styles.selectedCard]}
              >
                <View
                  style={[styles.checkPill, selected && styles.selectedPill]}
                >
                  {selected ? <Text style={styles.checkText}>✓</Text> : null}
                </View>

                <View style={styles.slotDetails}>
                  <Text style={styles.slotDate}>{slot.date}</Text>
                  <Text style={styles.slotTime}>{slot.time}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={sendAvailability}
        >
          <Text style={styles.primaryButtonText}>
            Preview demo availability
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Text style={styles.footerText}>
          Demo selections stay on this screen only. Nothing is sent to a
          landlord.
        </Text>
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
  instruction: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 34,
    marginBottom: 24,
  },
  slots: {
    gap: 16,
    marginBottom: 55,
  },
  slotCard: {
    height: 76,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  selectedCard: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  checkPill: {
    width: 32,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.unchecked,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectedPill: {
    backgroundColor: COLORS.primary,
  },
  checkText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  slotDetails: {
    gap: 8,
  },
  slotDate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  slotTime: {
    fontSize: 12,
    color: COLORS.muted,
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  backButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
