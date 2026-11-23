import { layout } from '../../theme/layout';
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
      <ScrollView contentContainerStyle={layout.content}>
        <Header
          title="Maintenance request"
          onBack={() => navigation.replace('History')}
        />
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
          variant="outline"
          onPress={() => navigation.replace('History')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
