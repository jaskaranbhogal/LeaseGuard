import { colors } from '../../theme/colors';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { MaintenanceRecord } from '../../components/MaintenanceRecords';

type Props = NativeStackScreenProps<TenantStackParamList, 'MaintenanceDetail'>;
export default function MaintenanceDetailScreen({ route, navigation }: Props) {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header title="Maintenance request" />
        <MaintenanceRecord
          id={route.params.requestId}
          onResume={() =>
            navigation.replace('ReportMaintenance', {
              draftId: route.params.requestId,
            })
          }
        />
        <Button
          title="Back to my requests"
          onPress={() => navigation.replace('History')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16 },
});
