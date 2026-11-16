import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useStore } from '../../src/store';
import { arrivalsOn, departuresOn, dogNames, occupiedKennelsAt, ownerName, upcoming } from '../../src/lib/booking';
import { displayDate, displayDay, localTime, today } from '../../src/lib/dates';
import { Button, H1, H2, H3, KennelBadge, Note, Panel, Screen, st, Tile } from '../../src/ui/components';
import { colors } from '../../src/ui/theme';

export default function Start() {
  const { db, loadDemo } = useStore();
  const t = today();
  const arrivals = arrivalsOn(db, t);
  const departures = departuresOn(db, t);
  const next = upcoming(db).filter(b => !arrivals.includes(b));
  const open = (id: string) => router.push(`/pobyt/${id}`);
  const empty = !db.owners.length && !db.bookings.length;

  return (
    <Screen>
      <H1>Dzień dobry!</H1>
      <Note>{displayDay(t)}</Note>
      <Button title="＋ Nowy pobyt" onPress={() => router.push('/pobyt/nowy')} />

      {empty ? (
        <Panel>
          <H2>Zaczynamy</H2>
          <Note>Nie ma jeszcze żadnych danych. Dodaj pierwszego klienta i pobyt albo wczytaj dane przykładowe, żeby wypróbować aplikację.</Note>
          <Button title="Dodaj klienta" kind="outline" onPress={() => router.push('/klient/nowy')} />
          <Button title="Wczytaj dane przykładowe" kind="outline" onPress={loadDemo} />
        </Panel>
      ) : null}

      <Panel>
        <H2>Teraz w hotelu</H2>
        <Text style={{ fontSize: 44, fontWeight: '900', color: colors.green }}>
          {occupiedKennelsAt(db)} / {db.settings.kennelCount}
        </Text>
        <Note>zajętych boksów</Note>
      </Panel>

      <Panel>
        <H2>Dziś przyjazdy ({arrivals.length})</H2>
        {arrivals.length ? arrivals.map(b => (
          <Tile key={b.id} leading={<KennelBadge n={b.kennel} />} label={`${localTime(b.arrival)} · ${dogNames(db, b)}`} sub={`Boks ${b.kennel} · ${ownerName(db, b.ownerId)}`} onPress={() => open(b.id)} />
        )) : <Note>Brak przyjazdów.</Note>}
      </Panel>

      <Panel>
        <H2>Dziś odbiory ({departures.length})</H2>
        {departures.length ? departures.map(b => (
          <Tile key={b.id} leading={<KennelBadge n={b.kennel} />} label={`${localTime(b.departure)} · ${dogNames(db, b)}`} sub={`Boks ${b.kennel} · ${ownerName(db, b.ownerId)}`} onPress={() => open(b.id)} />
        )) : <Note>Brak odbiorów.</Note>}
      </Panel>

      <Panel>
        <H3>Najbliższe rezerwacje</H3>
        {next.length ? next.map(b => (
          <Tile key={b.id} leading={<KennelBadge n={b.kennel} />} label={dogNames(db, b)} sub={`Boks ${b.kennel} · od ${displayDate(b.arrival)}`} onPress={() => open(b.id)} />
        )) : <Note>Brak nadchodzących rezerwacji.</Note>}
      </Panel>
      <View style={{ height: 4 }} />
      <Text style={[st.note, { fontSize: 14, textAlign: 'center' }]}>Dane są zapisane tylko na tym urządzeniu. Rób kopię zapasową w Ustawieniach.</Text>
    </Screen>
  );
}
