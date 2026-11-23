import { layout } from '../../theme/layout';
import { colors } from '../../theme/colors';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LandlordStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import Button from '../../components/Button';
import {
  MaintenanceRecord,
  MaintenanceRecords,
} from '../../components/MaintenanceRecords';

export function SavedMaintenanceList({
  navigation,
}: NativeStackScreenProps<LandlordStackParamList, 'MaintenanceRequests'>) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={layout.content}>
        <Header
          title="Maintenance requests"
          subtitle="Review repair requests and their saved evidence."
          onBack={() => navigation.goBack()}
        />
        <MaintenanceRecords
          onOpen={id =>
            navigation.navigate('SavedMaintenanceDetail', { requestId: id })
          }
        />
        <Button
          title="Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
export function SavedMaintenanceDetail({
  route,
  navigation,
}: NativeStackScreenProps<LandlordStackParamList, 'SavedMaintenanceDetail'>) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={layout.content}>
        <Header
          title="Maintenance request"
          onBack={() => navigation.goBack()}
        />
        <MaintenanceRecord id={route.params.requestId} landlord />
        <Button
          title="Back"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
