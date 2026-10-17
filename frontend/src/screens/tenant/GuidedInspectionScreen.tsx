import { colors } from '../../theme/colors';
import React from 'react';
import { useInspection } from '../../context/InspectionContext';
import DemoNotice from '../../components/DemoNotice';
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

import type { TenantStackParamList } from '../../navigation/types';
import { guidedInspectionMockData } from '../../data/guidedInspectionMockData';

type Props = NativeStackScreenProps<TenantStackParamList, 'GuidedInspection'>;

const COLORS = {
  background: colors.background,
  primary: '#1459EB',
  primaryLight: '#EBF2FF',
  text: '#131824',
  muted: '#5E6B80',
  border: '#D6DEEB',
  white: colors.white,
  track: '#EBEDF2',
  camera: '#333B4A',
  guide: '#CCD9EB',
};

export default function GuidedInspectionScreen({ navigation }: Props) {
  const { currentStepIndex, totalSteps } = useInspection();

  const step = guidedInspectionMockData.steps[currentStepIndex];

  function handleCapture() {
    navigation.navigate('ReviewInspectionPhoto', {
      stepIndex: currentStepIndex,
    });
  }

  function handleCancel() {
    Alert.alert(
      'Cancel inspection?',
      'Leave this demo? Your step progress stays available until you log out or close the app.',
      [
        { text: 'Keep inspecting', style: 'cancel' },
        {
          text: 'Leave inspection',
          style: 'destructive',
          onPress: () => navigation.popTo('TenantTabs'),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <DemoNotice />
        <Text style={styles.title}>{guidedInspectionMockData.title}</Text>

        <Text style={styles.subtitle}>
          Step {currentStepIndex + 1} of {totalSteps} • {step.area}
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
              },
            ]}
          />
        </View>

        <View style={styles.instructionsCard}>
          <View style={styles.guideBadge}>
            <Text style={styles.guideBadgeText}>PHOTO GUIDE</Text>
          </View>

          <Text style={styles.instructionTitle}>{step.instruction}</Text>

          <Text style={styles.instructionDescription}>{step.description}</Text>
        </View>

        <View style={styles.cameraPreview}>
          <Text style={styles.cameraTitle}>DEMO PLACEHOLDER</Text>

          <View style={styles.cameraGuide} />

          <Text style={styles.cameraHint}>{step.cameraHint}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.captureButton}
          onPress={handleCapture}
        >
          <Text style={styles.captureButtonText}>Review placeholder photo</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel inspection</Text>
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
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.track,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 20,
  },
  progressFill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  instructionsCard: {
    marginTop: 26,
    minHeight: 158,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    padding: 15,
  },
  guideBadge: {
    alignSelf: 'flex-start',
    height: 26,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },
  instructionTitle: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  instructionDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.muted,
  },
  cameraPreview: {
    height: 296,
    marginTop: 20,
    borderRadius: 20,
    backgroundColor: COLORS.camera,
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
  },
  cameraTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  cameraGuide: {
    width: '68%',
    height: 136,
    borderWidth: 2,
    borderColor: COLORS.guide,
    marginTop: 38,
  },
  cameraHint: {
    marginTop: 26,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.white,
    textAlign: 'center',
  },
  captureButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  captureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
