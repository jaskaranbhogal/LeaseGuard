import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TenantStackParamList } from '../../navigation/types';
import Button from '../../components/Button';
import { getGuided } from '../../services/guidedInspectionService';
export default function InspectionSubmittedScreen({
  route,
  navigation,
}: NativeStackScreenProps<TenantStackParamList, 'InspectionSubmitted'>) {
  const [message, setMessage] = useState('Checking server confirmation…');
  useEffect(() => {
    const id = route.params?.inspectionId;
    if (!id) {
      setMessage('Select an inspection to check its status.');
      return;
    }
    getGuided(id)
      .then(r =>
        setMessage(
          ['submitted', 'reviewed'].includes(r.status)
            ? `Inspection submitted · ${r.progress} photos saved. Your landlord can review the evidence.`
            : 'This inspection has not been submitted.',
        ),
      )
      .catch(e => setMessage(e.message));
  }, [route.params?.inspectionId]);
  return (
    <View>
      <Text>{message}</Text>
      <Button
        title="Back to dashboard"
        onPress={() => navigation.popTo('TenantTabs', { screen: 'Home' })}
      />
    </View>
  );
}
