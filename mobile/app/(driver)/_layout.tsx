import { Tabs } from 'expo-router';
import { Play, Clock, Users, UserCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { colors, iconSize } from '@/theme';

export default function DriverLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   colors.forest,
        tabBarInactiveTintColor: colors.slate,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor:  colors.stone,
          borderTopWidth:  0.5,
          height:          60,
          paddingBottom:   8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('driver.tab.trip'),
          tabBarIcon: ({ color }) => <Play size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('driver.tab.history'),
          tabBarIcon: ({ color }) => <Clock size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: t('driver.tab.students'),
          tabBarIcon: ({ color }) => <Users size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('driver.tab.profile'),
          tabBarIcon: ({ color }) => <UserCircle size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
