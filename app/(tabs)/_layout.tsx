import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/ui/theme';

const icon = (emoji: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { minHeight: 64, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Start', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="kalendarz" options={{ title: 'Kalendarz', tabBarIcon: icon('📅') }} />
      <Tabs.Screen name="klienci" options={{ title: 'Klienci', tabBarIcon: icon('🐶') }} />
      <Tabs.Screen name="historia" options={{ title: 'Historia', tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="ustawienia" options={{ title: 'Ustawienia', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
