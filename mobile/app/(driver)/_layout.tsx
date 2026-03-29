import { Tabs } from 'expo-router';
import { Play, Clock, UserCircle } from 'lucide-react-native';
import { colors, iconSize } from '@/theme';

export default function DriverLayout() {
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
          title: 'Trip',
          tabBarIcon: ({ color }) => <Play size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Clock size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <UserCircle size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
