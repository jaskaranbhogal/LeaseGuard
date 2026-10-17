import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import type { UserRole } from '../types/user';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = BottomTabBarProps & { role: UserRole };
const icons: Record<UserRole, Record<string, string>> = {
  landlord: { HomeStack: 'H', History: 'T', Settings: 'S' },
  tenant: { Home: 'H', Inspections: 'I', History: 'T', Settings: 'S' },
};

export default function BottomNavigation({ role, ...props }: Props) {
  const descriptors = Object.fromEntries(props.state.routes.map(route => {
    const descriptor = props.descriptors[route.key];
    const letter = icons[role][route.name] ?? route.name.charAt(0);
    return [route.key, {
      ...descriptor,
      options: {
        ...descriptor.options,
        tabBarActiveTintColor: colors.actionBlue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        tabBarIcon: ({ focused }: { focused: boolean }) => (
          <View style={[styles.icon, focused && styles.iconActive]}>
            <Text style={[styles.iconLetter, focused && styles.iconLetterActive]}>{letter}</Text>
          </View>
        ),
      },
    }];
  }));
  return <BottomTabBar {...props} descriptors={descriptors} />;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.white, borderTopColor: colors.border, paddingTop: 8 },
  label: { fontSize: 12, fontWeight: typography.medium },
  icon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECEEF3',
    alignItems: 'center', justifyContent: 'center',
  },
  iconActive: { backgroundColor: '#EAF1FE' },
  iconLetter: { fontSize: 15, fontWeight: typography.bold, color: colors.textSecondary },
  iconLetterActive: { color: colors.actionBlue },
});
