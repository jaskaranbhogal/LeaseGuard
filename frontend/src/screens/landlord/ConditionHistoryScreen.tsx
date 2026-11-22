import React from 'react';
import { StyleSheet } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { LandlordTabParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import Header from '../../components/Header';
import GuidedRecords from '../../components/GuidedRecords';
import { MaintenanceRecords } from '../../components/MaintenanceRecords';
import { spacing } from '../../theme/spacing';
export default function ConditionHistoryScreen({
  navigation,
}: BottomTabScreenProps<LandlordTabParamList, 'History'>) {
  return (
    <ScreenContainer style={styles.container}>
      <Header
        title="Condition history"
        subtitle="Review inspection evidence and maintenance records."
        style={styles.header}
      />
      <GuidedRecords
        onOpen={inspectionId =>
          navigation.navigate('HomeStack', {
            screen: 'AIInspectionReview',
            params: { inspectionId },
          })
        }
      />
      <MaintenanceRecords
        onOpen={requestId =>
          navigation.navigate('HomeStack', {
            screen: 'SavedMaintenanceDetail',
            params: { requestId },
          })
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: { marginBottom: spacing.lg },
});
