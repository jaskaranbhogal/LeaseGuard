import React from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { layout } from '../../theme/layout';
export default function ReviewInspectionPhotoScreen({
  navigation,
}: NativeStackScreenProps<TenantStackParamList, 'ReviewInspectionPhoto'>) {
  return (
    <ScreenContainer>
      <ScreenTitle
        title="Review inspection photo"
        onBack={() => navigation.goBack()}
      />
      <Text style={layout.body}>
        Open an assigned inspection to capture and review a photo.
      </Text>
      <Button
        title="Open inspections"
        onPress={() => navigation.navigate('GuidedInspection')}
      />
    </ScreenContainer>
  );
}
