import Icon, { type IconName } from './Icon';
import {
  BottomTabBar,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import type { UserRole } from '../types/user';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = BottomTabBarProps & { role: UserRole };
const icons: Record<UserRole, Record<string, string>> = {
  landlord: { HomeStack: 'H', History: 'T', Settings: 'S' },
  tenant: { Home: 'H', Inspections: 'I', History: 'T', Settings: 'S' },
};

const tabIcons: Record<
  string,
  (props: { focused: boolean }) => React.ReactNode
> = {};
const names: Record<string, IconName> = {
  H: 'home',
  I: 'inspection',
  T: 'history',
  S: 'settings',
};
for (const letter of ['H', 'I', 'T', 'S']) {
  tabIcons[letter] = function TabIcon({ focused }) {
    return (
      <View style={[styles.icon, focused && styles.iconActive]}>
        <Icon
          name={names[letter]}
          size={22}
          color={focused ? colors.brand : colors.muted}
        />
      </View>
    );
  };
}

export default function BottomNavigation({ role, ...props }: Props) {
  const descriptors = Object.fromEntries(
    props.state.routes.map(route => {
      const descriptor = props.descriptors[route.key];
      const letter = icons[role][route.name] ?? route.name.charAt(0);
      return [
        route.key,
        {
          ...descriptor,
          options: {
            ...descriptor.options,
            tabBarActiveTintColor: colors.actionBlue,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarLabelStyle: styles.label,
            tabBarStyle: styles.bar,
            tabBarIcon: tabIcons[letter],
          },
        },
      ];
    }),
  );
  return <BottomTabBar {...props} descriptors={descriptors} />;
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  label: { fontSize: 12, fontWeight: typography.medium },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: colors.brandSoft },
});
