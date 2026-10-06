import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// The active tab's icon is filled and sits on a brand-green pill, so the state is shown by
// shape as well as colour.
const tabIcon = (outline: IconName, filled: IconName) => {
  const TabIcon = ({ focused }: { focused: boolean }) => (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={focused ? filled : outline} color={colors.ink} size={20} />
    </View>
  );
  return TabIcon;
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        // Keep labels under the icons on wide screens too, so the active pill never overlaps.
        tabBarLabelPosition: 'below-icon',
        sceneStyle: { backgroundColor: colors.paper },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: 'Groups', tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: tabIcon('receipt-outline', 'receipt') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
    minHeight: 64,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    marginTop: 4,
  },
  pill: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.brand,
  },
});
