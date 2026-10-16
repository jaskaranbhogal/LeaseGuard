import { colors } from '../../theme/colors';
import DemoNotice from '../../components/DemoNotice';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { TenantStackParamList } from '../../navigation/types';
import { reportMaintenanceMockData } from '../../data/reportMaintenanceMockData';

type Props = NativeStackScreenProps<TenantStackParamList, 'ReportMaintenance'>;

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
};

export default function ReportMaintenanceScreen({ navigation }: Props) {
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');

  function handleAddMedia() {
    Alert.alert(
      'Media upload coming soon',
      'Photo and video selection will be enabled when media upload is integrated.',
    );
  }

  function handleSubmit() {
    if (!area.trim()) {
      Alert.alert('Area required', 'Please enter the area that needs repair.');
      return;
    }

    if (!description.trim()) {
      Alert.alert(
        'Description required',
        'Please describe the maintenance issue.',
      );
      return;
    }

    Alert.alert(
      'Demo form complete',
      'Your form is complete. Maintenance submissions will be enabled when backend integration is ready. Nothing has been submitted yet.',
      [{ text: 'OK' }],
    );
  }

  function handleCancel() {
    if (!area.trim() && !description.trim()) {
      navigation.goBack();
      return;
    }

    Alert.alert('Discard report?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.goBack(),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{reportMaintenanceMockData.title}</Text>
        <DemoNotice />

        <Text style={styles.subtitle}>
          {reportMaintenanceMockData.subtitle}
        </Text>

        <Text style={styles.label}>Area</Text>

        <TextInput
          style={styles.input}
          value={area}
          onChangeText={setArea}
          placeholder={reportMaintenanceMockData.areaPlaceholder}
          placeholderTextColor={COLORS.muted}
          accessibilityLabel="Area"
        />

        <Text style={styles.mediaLabel}>Media</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photo or video"
          onPress={handleAddMedia}
          style={styles.mediaCard}
        >
          <View style={styles.addIcon}>
            <Text style={styles.plusText}>+</Text>
          </View>

          <Text style={styles.mediaTitle}>Add photo or video</Text>

          <Text style={styles.mediaSubtitle}>
            Up to {reportMaintenanceMockData.maxMediaFiles} files
          </Text>
        </Pressable>

        <Text style={styles.descriptionLabel}>Description</Text>

        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder={reportMaintenanceMockData.descriptionPlaceholder}
          placeholderTextColor={COLORS.muted}
          accessibilityLabel="Description"
          multiline
          textAlignVertical="top"
        />

        <View style={styles.urgencyCard}>
          <View style={styles.urgencyBadge}>
            <Text style={styles.urgencyBadgeText}>
              {reportMaintenanceMockData.urgency.label}
            </Text>
          </View>

          <View style={styles.urgencyDetails}>
            <Text style={styles.urgencyTitle}>
              {reportMaintenanceMockData.urgency.value}
            </Text>

            <Text style={styles.urgencySubtitle}>
              {reportMaintenanceMockData.urgency.note}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            Preview demo request
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={styles.cancelButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        <Text style={styles.footer}>{reportMaintenanceMockData.footer}</Text>
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
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 30,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 13,
  },
  mediaLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 16,
    marginBottom: 8,
  },
  mediaCard: {
    height: 126,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingTop: 19,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  mediaTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  mediaSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.muted,
    marginTop: 24,
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 48,
    maxHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 12,
  },
  urgencyCard: {
    minHeight: 72,
    marginTop: 20,
    backgroundColor: COLORS.orangeLight,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  urgencyBadge: {
    height: 26,
    width: 92,
    borderRadius: 13,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  urgencyBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
  },
  urgencyDetails: {
    flex: 1,
    paddingTop: 2,
  },
  urgencyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  urgencySubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 7,
    lineHeight: 15,
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 38,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  cancelButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  footer: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
});
