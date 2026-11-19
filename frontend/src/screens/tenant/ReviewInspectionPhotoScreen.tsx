import React from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
import ScreenContainer from '../../components/ScreenContainer';
export default function ReviewInspectionPhotoScreen({
  navigation,
}: NativeStackScreenProps<TenantStackParamList, 'ReviewInspectionPhoto'>) {
  return (
    <ScreenContainer>
      <Text>Open an assigned inspection to capture and review a photo.</Text>
      <Button
        title="Open inspections"
        onPress={() => navigation.navigate('GuidedInspection')}
      />
    </ScreenContainer>
  );
}
