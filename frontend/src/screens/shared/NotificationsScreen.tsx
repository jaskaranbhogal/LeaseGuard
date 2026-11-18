import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  LandlordStackParamList,
  TenantStackParamList,
} from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import Button from '../../components/Button';
import {
  guidedNotifications,
  readNotification,
} from '../../services/guidedInspectionService';
export default function NotificationsScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        Pick<LandlordStackParamList, 'AIInspectionReview'> &
          Pick<TenantStackParamList, 'GuidedInspection'>
      >
    >();
  const { user } = useAuth();
  const [records, setRecords] = useState<
    Awaited<ReturnType<typeof guidedNotifications>>['notifications']
  >([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setRecords((await guidedNotifications()).notifications);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  async function mark(id: string) {
    try {
      await readNotification(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <ScreenContainer>
      <Button title="Back" onPress={() => navigation.goBack()} />
      <Text>Inspection notifications</Text>
      <Text>In-app updates. Email and push delivery are not enabled.</Text>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <Button title="Refresh notifications" onPress={load} />
      {!records.length && <Text>No inspection notifications.</Text>}
      {records.map(n => (
        <View key={n.id}>
          <Text>{n.message}</Text>
          <Text>{new Date(n.created_at).toLocaleString()}</Text>
          <Button
            title="Open inspection"
            onPress={() => {
              if (user?.role === 'landlord')
                (
                  navigation as NativeStackNavigationProp<LandlordStackParamList>
                ).navigate('AIInspectionReview', {
                  inspectionId: n.inspection_id,
                });
              else
                (
                  navigation as NativeStackNavigationProp<TenantStackParamList>
                ).navigate('GuidedInspection', {
                  inspectionId: n.inspection_id,
                });
            }}
          />
          {!n.read && <Button title="Mark read" onPress={() => mark(n.id)} />}
        </View>
      ))}
    </ScreenContainer>
  );
}
