import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import Header from '../../components/Header';
import Button from '../../components/Button';
import GuidedRecords from '../../components/GuidedRecords';
import { MaintenanceRecords } from '../../components/MaintenanceRecords';
export default function UnitHistoryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<TenantStackParamList, 'History'>>();
  return (
    <ScreenContainer>
      <Header title="Unit history" />
      <Button
        title="Back to dashboard"
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'TenantTabs', params: { screen: 'Home' } }],
          })
        }
      />
      <GuidedRecords
        onOpen={inspectionId =>
          navigation.navigate('GuidedInspection', { inspectionId })
        }
      />
      <MaintenanceRecords
        onOpen={requestId =>
          navigation.navigate('MaintenanceDetail', { requestId })
        }
        onResume={draftId =>
          navigation.navigate('ReportMaintenance', { draftId })
        }
      />
    </ScreenContainer>
  );
}
