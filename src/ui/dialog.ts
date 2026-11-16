import { Alert, Platform } from 'react-native';

// Alert z React Native nie działa w przeglądarce (react-native-web go ignoruje),
// dlatego na webie używamy natywnych okien przeglądarki.

export function notify(title: string, message = '') {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirm(title: string, message: string, okLabel = 'Potwierdź', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise(resolve =>
    Alert.alert(title, message, [
      { text: 'Wróć', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
