import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../src/store';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <StoreProvider>
        <Stack screenOptions={{ headerShown: false, title: 'Psotelgracja' }} />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
