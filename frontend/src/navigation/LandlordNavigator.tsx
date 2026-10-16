import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AccountScreen from '../components/AccountScreen';

const Stack = createNativeStackNavigator<{ LandlordHome: undefined }>();
function LandlordHome() {
  return (
    <AccountScreen
      title="Landlord dashboard coming soon"
      message="You are signed in as a landlord. Property management and landlord tools are still being built."
    />
  );
}
export default function LandlordNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LandlordHome" component={LandlordHome} />
    </Stack.Navigator>
  );
}
