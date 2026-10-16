import { colors } from '../../theme/colors';
import DemoNotice from '../../components/DemoNotice';
import React, { useState } from 'react';
import Button from '../../components/Button';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { TenantStackParamList } from '../../navigation/types';
import {
  findMaintenanceRequest,
  type MaintenanceStatus,
} from '../../data/maintenanceDetailMockData';

type Props = NativeStackScreenProps<TenantStackParamList, 'MaintenanceDetail'>;

const COLORS = {
  background: colors.background,
  white: colors.white,
  primary: '#2865F3',
  text: '#131824',
  muted: '#9099AA',
  border: '#D6DEEB',
  card: '#F2F2F6',
  orange: '#FF792A',
  orangeLight: '#FFF1E5',
};

const PROGRESS_STEPS: {
  id: MaintenanceStatus;
  label: string;
}[] = [
  { id: 'submitted', label: 'Submitted' },
  { id: 'in-review', label: 'In Review' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
];

export default function MaintenanceDetailScreen({ navigation, route }: Props) {
  const request = findMaintenanceRequest(route.params?.requestId);
  const [showProgress, setShowProgress] = useState(true);

  function back() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('TenantTabs', { screen: 'History' });
    }
  }
  if (!request) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text accessibilityRole="alert" style={styles.title}>
            Sample request not found
          </Text>
          <Button title="Back to my requests" onPress={back} />
        </View>
      </SafeAreaView>
    );
  }
  const currentStep = PROGRESS_STEPS.findIndex(
    step => step.id === request.status,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Maintenance request</Text>
        <DemoNotice />

        <Text style={styles.subtitle}>{request.location}</Text>

        <View style={styles.urgencyBadge}>
          <Text style={styles.urgencyText}>{request.urgency}</Text>
        </View>

        <View style={styles.requestCard}>
          <View style={styles.requestInfo}>
            <Text style={styles.issueTitle}>{request.description}</Text>

            <Text style={styles.requestMeta}>
              Reported: {request.reportedDate}
            </Text>

            <Text style={styles.requestMeta}>
              Media: {request.photoCount}{' '}
              {request.photoCount === 1 ? 'photo' : 'photos'},{' '}
              {request.videoCount}{' '}
              {request.videoCount === 1 ? 'video' : 'videos'}
            </Text>
          </View>

          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaPlaceholderText}>MEDIA</Text>
          </View>
        </View>

        <View style={styles.statusHeader}>
          <Text style={styles.sectionTitle}>Status</Text>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {PROGRESS_STEPS[currentStep]?.label ?? 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressLine} />

          {PROGRESS_STEPS.map((step, index) => {
            const completed = index < currentStep;
            const active = index === currentStep;

            return (
              <View key={step.id} style={styles.step}>
                <View
                  style={[
                    styles.stepCircle,
                    (completed || active) && styles.stepCircleActive,
                    active && styles.stepCircleCurrent,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepIcon,
                      (completed || active) && styles.stepIconActive,
                    ]}
                  >
                    {completed ? '✓' : active ? '●' : ''}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.stepLabel,
                    (completed || active) && styles.stepLabelActive,
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleIcon}>◎</Text>

            <Text style={styles.toggleLabel}>
              {showProgress ? 'Hide progress' : 'Show progress'}
            </Text>
          </View>

          <Switch
            accessibilityLabel="Show maintenance progress"
            value={showProgress}
            onValueChange={setShowProgress}
            trackColor={{
              false: COLORS.border,
              true: COLORS.primary,
            }}
            thumbColor={COLORS.white}
          />
        </View>

        {showProgress ? (
          <View style={styles.updatesCard}>
            <Text style={styles.updatesHeading}>WHAT'S HAPPENING</Text>

            {request.updates.map(update => (
              <View key={update.id} style={styles.updateRow}>
                <Text style={styles.updateDate}>{update.date}</Text>

                <Text
                  style={[
                    styles.updateMessage,
                    update.highlighted && styles.highlightedUpdate,
                  ]}
                >
                  {update.message}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          style={styles.backButton}
          onPress={back}
        >
          <Text style={styles.backButtonText}>Back to my requests</Text>
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
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 5,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.orangeLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 18,
    marginBottom: 16,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.orange,
    letterSpacing: 0.5,
  },
  requestCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E6E6EC',
    minHeight: 132,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
    paddingRight: 10,
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 19,
  },
  requestMeta: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 6,
  },
  mediaPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#DFE3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    backgroundColor: '#EAF1FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    marginBottom: 20,
  },
  progressLine: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: 2,
    backgroundColor: '#DDE2EB',
    top: 14,
  },
  step: {
    width: '25%',
    alignItems: 'center',
  },
  stepCircle: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: '#E1E5ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepCircleCurrent: {
    borderWidth: 5,
    borderColor: '#BCD0FF',
  },
  stepIcon: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  stepIconActive: {
    color: COLORS.white,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 7,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  toggleCard: {
    height: 55,
    borderWidth: 2,
    borderColor: '#292929',
    borderRadius: 17,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  updatesCard: {
    backgroundColor: COLORS.card,
    borderColor: '#E4E6EC',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  updatesHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.muted,
    marginBottom: 16,
  },
  updateRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  updateDate: {
    width: 70,
    fontSize: 13,
    color: COLORS.muted,
  },
  updateMessage: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  highlightedUpdate: {
    color: COLORS.orange,
    fontWeight: '600',
  },
  backButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E6EC',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  backButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
