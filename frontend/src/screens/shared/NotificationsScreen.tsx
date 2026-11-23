import React, { useCallback, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  LandlordStackParamList,
  TenantStackParamList,
} from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import Button from '../../components/Button';
import ScreenTitle from '../../components/ScreenTitle';
import StateCard from '../../components/StateCard';
import StatusBadge from '../../components/StatusBadge';
import { layout } from '../../theme/layout';
import { colors } from '../../theme/colors';
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
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords((await guidedNotifications()).notifications);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  async function mark(id: string) {
    if (marking) return;
    setMarking(id);
    try {
      await readNotification(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarking(null);
    }
  }
  return (
    <ScreenContainer>
      <ScreenTitle
        title="Notifications"
        subtitle="Inspection updates and activity for your account."
        onBack={() => navigation.goBack()}
      />
      <View style={layout.notice}>
        <Text style={layout.muted}>
          In-app updates. Email and push delivery are not enabled.
        </Text>
      </View>
      {!!error && (
        <Text style={layout.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button
        title="Refresh notifications"
        variant="outline"
        loading={loading}
        onPress={load}
      />
      {loading && !records.length && (
        <StateCard title="Loading notifications…" loading />
      )}
      {!loading && !error && !records.length && (
        <StateCard
          title="You're all caught up"
          message="No inspection notifications. New inspection activity will appear here."
        />
      )}
      {records.map(n => (
        <View key={n.id} style={[layout.card, !n.read && styles.unread]}>
          <StatusBadge status={n.read ? 'Read' : 'New update'} />
          <Text style={layout.body}>{n.message}</Text>
          <Text style={layout.muted}>
            {new Date(n.created_at).toLocaleString()}
          </Text>
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
          {!n.read && (
            <Button
              title="Mark read"
              variant="outline"
              disabled={!!marking}
              loading={marking === n.id}
              onPress={() => mark(n.id)}
            />
          )}
        </View>
      ))}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  unread: {
    borderColor: colors.brandSoftBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand,
  },
});
