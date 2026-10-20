import Header from '../../components/Header';
import { colors } from '../../theme/colors';
import React from 'react';
import { useInspection } from '../../context/InspectionContext';
import { guidedInspectionMockData } from '../../data/guidedInspectionMockData';
import Button from '../../components/Button';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { TenantStackParamList } from '../../navigation/types';
import { reviewInspectionPhotoMockData } from '../../data/reviewInspectionPhotoMockData';

type Props = NativeStackScreenProps<
  TenantStackParamList,
  'ReviewInspectionPhoto'
>;

const COLORS = {
  background: colors.background,
  white: colors.white,
  primary: '#1459EB',
  text: '#131824',
  muted: '#5E6B80',
  border: '#D6DEEB',
  photo: '#D1D9E3',
  green: '#14874A',
  greenLight: '#E5FAF0',
};

export default function ReviewInspectionPhotoScreen({
  navigation,
  route,
}: Props) {
  const data = reviewInspectionPhotoMockData;

  const { currentStepIndex, totalSteps, complete, acceptStep } =
    useInspection();
  const step = guidedInspectionMockData.steps[currentStepIndex];
  if (complete || route.params?.stepIndex !== currentStepIndex) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>This demo step is no longer active.</Text>
        <Button
          title="Return to inspection"
          onPress={() => navigation.popTo('GuidedInspection')}
        />
      </SafeAreaView>
    );
  }
  function handleUsePhoto() {
    acceptStep(currentStepIndex);
    if (currentStepIndex + 1 === totalSteps) {
      navigation.reset({
        index: 1,
        routes: [{ name: 'TenantTabs' }, { name: 'InspectionSubmitted' }],
      });
    } else {
      navigation.popTo('GuidedInspection');
    }
  }

  function handleRetake() {
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Header title={data.title} titleStyle={styles.title} />

        <Text style={styles.subtitle}>
          {step.area} • Step {currentStepIndex + 1} of {totalSteps}
        </Text>

        <View style={styles.photoPreview}>
          <Text style={styles.photoLabel}>{data.photoLabel}</Text>
        </View>

        <View style={styles.qualityCard}>
          <View style={styles.qualityBadge}>
            <Text style={styles.qualityBadgeText}>{data.quality.badge}</Text>
          </View>

          <View style={styles.qualityDetails}>
            <Text style={styles.qualityTitle}>{data.quality.title}</Text>

            <Text style={styles.qualityDescription}>
              {data.quality.description}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={handleUsePhoto}
        >
          <Text style={styles.primaryButtonText}>
            {currentStepIndex + 1 === totalSteps
              ? 'Complete demo'
              : 'Use placeholder and continue'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={handleRetake}
        >
          <Text style={styles.secondaryButtonText}>Retake demo photo</Text>
        </Pressable>

        <Text style={styles.footer}>{data.footer}</Text>
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
    paddingBottom: 36,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
  },
  photoPreview: {
    height: 332,
    marginTop: 28,
    backgroundColor: COLORS.photo,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
  qualityCard: {
    minHeight: 90,
    marginTop: 20,
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.green,
    backgroundColor: COLORS.greenLight,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  qualityBadge: {
    height: 26,
    minWidth: 58,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  qualityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },
  qualityDetails: {
    flex: 1,
    paddingTop: 3,
  },
  qualityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  qualityDescription: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 12,
    lineHeight: 17,
  },
  primaryButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  secondaryButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
