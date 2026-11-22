import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import ActionButton from '../../components/ActionButton';
export default function InviteEmailScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'InviteEmail'>) {
  return (
    <ScreenContainer>
      <ScreenTitle title="Join your unit" onBack={() => navigation.goBack()} />
      <Text>
        Register with the email your landlord invited, then enter the single-use
        code from your invitation email after signing in.
      </Text>
      <ActionButton
        title="Create tenant account"
        onPress={() => navigation.navigate('Register')}
      />
      <ActionButton
        title="Sign in"
        onPress={() => navigation.navigate('Login')}
      />
    </ScreenContainer>
  );
}
