import { router } from 'expo-router';
import { Button, H1, Note, Screen } from '../src/ui/components';

export default function NotFound() {
  return (
    <Screen title="Nie znaleziono">
      <H1>Nie ma takiej strony</H1>
      <Note>Ten adres nie istnieje.</Note>
      <Button title="Wróć na start" onPress={() => router.replace('/')} />
    </Screen>
  );
}
