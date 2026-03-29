import { Tabs } from 'expo-router';
import { Map, AlertTriangle, Megaphone } from 'lucide-react-native';
import { colors, iconSize } from '@/theme';

export default function ManagerLayout() {
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
          title: 'Fleet',
          tabBarIcon: ({ color }) => <Map size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarBadge: 2,
          tabBarIcon: ({ color }) => <AlertTriangle size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="broadcast"
        options={{
          title: 'Broadcast',
          tabBarIcon: ({ color }) => <Megaphone size={iconSize.lg} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
