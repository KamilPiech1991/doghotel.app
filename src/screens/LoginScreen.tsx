import { useState } from 'react';
import { supabase } from '../backend/supabase';
import { friendlyError } from '../backend/mapping';
import { Button, Field, H1, Note, Panel, Screen, Warning } from '../ui/components';
import { TextInput, Text, View } from 'react-native';
import { st } from '../ui/components';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!supabase) return;
    if (!email.trim() || !password) return setError('Wpisz e-mail i hasło.');
    setBusy(true);
    setError('');
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(friendlyError(e));
  };

  return (
    <Screen title="Logowanie">
      <H1>Zaloguj się</H1>
      <Panel>
        <Field label="E-mail" value={email} onChange={setEmail} keyboardType="email-address" placeholder="np. anna@hotel.pl" />
        <View style={st.field}>
          <Text style={st.label}>Hasło</Text>
          <TextInput
            accessibilityLabel="Hasło"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={login}
            style={st.input}
          />
        </View>
        {error ? <Warning>{error}</Warning> : null}
        <Button title={busy ? 'Logowanie…' : 'Zaloguj się'} onPress={login} disabled={busy} />
      </Panel>
      <Note>Konto zakłada właściciel hotelu w panelu Supabase. Jeśli nie pamiętasz hasła, poproś go o jego zmianę.</Note>
    </Screen>
  );
}

export function NoAccessScreen({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <Screen title="Brak dostępu">
      <H1>Brak dostępu</H1>
      <Warning>Konto {email} nie jest na liście personelu hotelu.</Warning>
      <Note>Właściciel musi dodać ten adres e-mail do tabeli „staff” w Supabase.</Note>
      <Button title="Wyloguj się" kind="outline" onPress={onSignOut} />
    </Screen>
  );
}

export function ErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Screen title="Błąd połączenia">
      <H1>Nie udało się wczytać danych</H1>
      <Warning>{message}</Warning>
      <Button title="Spróbuj ponownie" onPress={onRetry} />
      <Button title="Wyloguj się" kind="outline" onPress={onSignOut} />
    </Screen>
  );
}
