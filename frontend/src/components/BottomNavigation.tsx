
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type UserRole = 'tenant' | 'landlord';

type Props = BottomTabBarProps & {
  role: UserRole;
};

const COLORS = {
  white: '#FFFFFF',
  border: '#D6DEEB',
  active: '#1459EB',
  inactive: '#5E6B80',
  activeBackground: '#EBF2FF',
  inactiveBackground: '#EBEDF2',
};

const NAV_ITEMS: Record<UserRole, Record<string, string>> = {
  tenant: {
    Home: 'H',
    Inspections: 'I',
    History: 'T',
    Settings: 'S',
  },
  landlord: {
    Home: 'H',
    Properties: 'P',
    History: 'T',
    Settings: 'S',
  },
};

export default function BottomNavigation({
  state,
  descriptors,
  navigation,
  role,
}: Props) {
  const insets = useSafeAreaInsets();
  const icons = NAV_ITEMS[role];

  return (
    <View
      style={[
        styles.container,
        {paddingBottom: Math.max(insets.bottom, 8)},
      ]}>
      {state.routes.map((route, index) => {
        const icon = icons[route.name] ?? route.name.charAt(0);
        const active = state.index === index;
        const options = descriptors[route.key].options;

        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : route.name;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={
              options.tabBarAccessibilityLabel ?? label
            }
            accessibilityState={{selected: active}}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!active && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            }}>
            <View
              style={[
                styles.iconCircle,
                active && styles.activeCircle,
              ]}>
              <Text
                style={[
                  styles.iconText,
                  active && styles.activeText,
                ]}>
                {icon}
              </Text>
            </View>

            <Text
              style={[
                styles.label,
                active && styles.activeText,
              ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 9,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.inactiveBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCircle: {
    backgroundColor: COLORS.activeBackground,
  },
  iconText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inactive,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.inactive,
    marginTop: 4,
  },
  activeText: {
    color: COLORS.active,
    fontWeight: '700',
  },
});
