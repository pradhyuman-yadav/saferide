import { Tabs } from 'expo-router';
import { Map, Navigation, Bell, Clock, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors, iconSize } from '@/theme';

export default function ParentLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarActiveTintColor:   colors.forest,
        tabBarInactiveTintColor: colors.slate,
        tabBarStyle: {
          backgroundColor:  colors.background,
          borderTopColor:   colors.stone,
          borderTopWidth:   0.5,
          height:           60,
          paddingBottom:    8,
        },
        tabBarLabelStyle: {
          fontSize:    10,
          fontWeight:  '500',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.live'),
          // Tab bar is hidden on the map screen — navigation lives inside the
          // bottom card (Uber-style). Other screens still show the tab bar.
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color }) => <Map size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: t('tab.route'),
          tabBarIcon: ({ color }) => <Navigation size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tab.alerts'),
          tabBarIcon: ({ color }) => <Bell size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tab.history'),
          tabBarIcon: ({ color }) => <Clock size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarIcon: ({ color }) => <User size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
