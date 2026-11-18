import React from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { LandlordTabParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import Header from '../../components/Header';
import GuidedRecords from '../../components/GuidedRecords';
import { MaintenanceRecords } from '../../components/MaintenanceRecords';
export default function ConditionHistoryScreen({
  navigation,
}: BottomTabScreenProps<LandlordTabParamList, 'History'>) {
  return (
    <ScreenContainer>
      <Header title="Condition history" />
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
